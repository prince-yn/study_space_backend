const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pdf } = require('pdf-to-img');
const verifyToken = require('../auth_middleware');
const upload = require('../config/multer');
const { generateWithFallback } = require('../config/gemini');
const Material = require('../models/Material');
const Subject = require('../models/Subject');
const Space = require('../models/Space');
const { searchImages, extractImagePlaceholders, replaceImagePlaceholders } = require('../utils/imageSearch');
const { processDiagramBlocks } = require('../utils/kroki');

// Helper function to add timeout to promises
const withTimeout = (promise, timeoutMs, operationName) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs/1000}s`)), timeoutMs)
        )
    ]);
};

// Helper function to check if user can edit
const canUserEdit = async (spaceId, userId) => {
    const space = await Space.findById(spaceId);
    if (!space) return false;

    const userIdStr = userId.toString();
    const isOwner = space.owner.toString() === userIdStr;
    const isAdmin = space.admins.some(admin => admin.toString() === userIdStr);
    const isEditor = space.editors && space.editors.some(editor => editor.toString() === userIdStr);
    return isOwner || isAdmin || isEditor;
};

// Scan Notes - Upload files and convert to Markdown with LaTeX
router.post('/create', verifyToken, (req, res, next) => {
    if (req.headers['content-type']?.includes('application/json')) {
        return next();
    }
    
    const uploadHandler = upload.array('files', 20);
    uploadHandler(req, res, (err) => {
        if (err) {
            return res.status(400).json({ 
                status: 'error', 
                message: `File upload failed: ${err.message}` 
            });
        }
        next();
    });
}, async (req, res) => {
    const uploadedFiles = req.files || [];
    const { subjectId, prompt, files: base64Files } = req.body;

    try {
        if (!subjectId) {
            return res.status(400).json({ status: 'error', message: 'Subject ID is required' });
        }

        // Validate ObjectId format
        if (!subjectId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ status: 'error', message: 'Invalid subject ID format' });
        }

        // Verify subject exists and get space ID
        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ status: 'error', message: 'Subject not found' });
        }

        // Check if user has edit permission
        if (!(await canUserEdit(subject.spaceId, req.user._id))) {
            return res.status(403).json({ status: 'error', message: 'You do not have permission to create materials in this space' });
        }

        let contentParts = [];
        let sourceFiles = [];


        const systemPrompt = `# Role
You are an expert Academic Assistant that transforms rough study materials (blackboard photos, scribbled notes, or transcripts) into high-quality, structured Markdown notes.

# Task
Analyze the input and generate a comprehensive study guide. Expand fragmented thoughts into clear explanations and solve any homework questions or math problems found in the notes.

# Guidelines
1. **Formatting:** Use the full range of Markdown. Use # for titles, ## and ### for hierarchy, and **bold** for key terms. Use tables for comparisons and --- (horizontal rules) to separate different topics or sections.
2. **Mathematical Notation:** Use LaTeX for all formulas and variables.
   * Inline: $E = mc^2$
   * Block: $$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
3. **Diagrams (Kroki.io):** Use code blocks to recreate sketches or logic. Use the best engine for the data (mermaid, plantuml, graphviz, dot, blockdiag, seqdiag, actdiag, nwdiag, packetdiag, rackdiag, c4plantuml, ditaa, erd, structurizr, vega, vegalite, wireviz).
   * **Example: (Use the most relevant engine provided above, not only mermaid)**
     \`\`\`mermaid
     graph TD;
     A[Light] --> B{Photosynthesis};
     B --> C[Oxygen];
     B --> D[Glucose];
     \`\`\`
4. **Visual Placeholders:** Use {{IMAGE: description}} for common graphs, anatomy, or complex photos, maps that cannot be coded.
   * **Example:** {{IMAGE: supply and demand curve graph}} or {{IMAGE: structure of a plant cell}} or {{IMAGE: visible light spectrum}}.
5. **Tone & Style:** Maintain a "Helpful Peer" tone—approachable, clear, and easy to read. Avoid dense jargon unless it is a key term being defined. Preferably use Indian English conventions.
6. **Fallback Logic:** If the input is missing, blurry, or extremely sparse, generate a comprehensive college-level overview of the identified topic so the user still gets a useful study guide.
7. **Safety:** If the content is inappropriate, harmful, or nonsensical, respond ONLY with "REFUSE".

# Output Format
# [Title]
> **Summary:** A brief overview of the notes.

---
[Structured Markdown Content with Diagrams and Placeholders]

---
## Solutions
[Step-by-step solutions for any problems found in the notes]
`;

        contentParts.push(systemPrompt);

        // Handle base64 encoded files (from JSON)
        if (base64Files && Array.isArray(base64Files)) {
            for (const encodedFile of base64Files) {
                const { filename, data, mimetype } = encodedFile;
                
                if (!filename || !data || !mimetype) {
                    continue;
                }
                
                sourceFiles.push({
                    originalName: filename,
                    fileType: mimetype.includes('pdf') ? 'pdf' : 'image',
                    size: data.length,
                    url: 'base64'
                });
                
                contentParts.push({
                    inlineData: {
                        data: data,
                        mimeType: mimetype
                    }
                });
            }
        }

        // Process uploaded files (multipart)
        for (const file of uploadedFiles) {
            const ext = path.extname(file.originalname).toLowerCase();
            const isPdf = ext === '.pdf';

            let fileUrl = null;
            if (!isPdf && process.env.USE_CLOUDINARY === 'true') {
                try {
                    const cloudinary = require('../config/cloudinary');
                    
                    const uploadResult = await new Promise((resolve, reject) => {
                        const uploadStream = cloudinary.uploader.upload_stream(
                            {
                                folder: 'study_space',
                                resource_type: 'auto'
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                        uploadStream.end(file.buffer);
                    });
                    
                    fileUrl = uploadResult.secure_url;
                } catch (uploadError) {
                    fileUrl = 'memory';
                }
            } else {
                fileUrl = isPdf ? 'memory' : (file.path || 'memory');
            }

            sourceFiles.push({
                originalName: file.originalname,
                fileType: isPdf ? 'pdf' : 'image',
                size: file.size,
                url: fileUrl
            });

            if (isPdf) {
                const pdfBuffer = file.buffer;
                const pdfSizeMB = pdfBuffer.length / 1024 / 1024;
                
                if (pdfSizeMB > 20) {
                    contentParts.push({
                        text: `PDF "${file.originalname}" is too large (${pdfSizeMB.toFixed(1)} MB). Please use a smaller file.`
                    });
                    continue;
                }
                
                try {
                    const document = await pdf(pdfBuffer, { scale: 2.0 });
                    let pageNum = 0;
                    
                    for await (const image of document) {
                        pageNum++;
                        
                        if (pageNum > 20) {
                            break;
                        }
                        
                        const base64Image = image.toString('base64');
                        contentParts.push({
                            inlineData: {
                                data: base64Image,
                                mimeType: 'image/png'
                            }
                        });
                    }
                } catch (conversionError) {
                    const base64Pdf = pdfBuffer.toString('base64');
                    contentParts.push({
                        inlineData: {
                            data: base64Pdf,
                            mimeType: 'application/pdf'
                        }
                    });
                }
            } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                const imageBuffer = file.buffer;

                const base64Image = imageBuffer.toString('base64');
                const mimeTypes = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp'
                };
                const mimeType = mimeTypes[ext] || 'image/jpeg';

                contentParts.push({
                    inlineData: {
                        data: base64Image,
                        mimeType: mimeType
                    }
                });
            }
        }

        // Add text prompt if provided
        if (prompt && prompt.trim()) {
            contentParts.push({
                text: `User Prompt: ${prompt}`
            });
        }

        // Check if we have any content
        if (contentParts.length === 1) {
            return res.status(400).json({
                status: 'error',
                message: 'Please provide at least one file or a text prompt'
            });
        }

        const result = await withTimeout(
            generateWithFallback(contentParts),
            300000,
            'Gemini API generation'
        );
        
        const response = await result.response;
        let generatedText = response.text();

        if (generatedText.trim() === 'REFUSE' || generatedText.trim().startsWith('REFUSE')) {
            return res.status(400).json({
                status: 'error',
                message: 'The provided content was deemed inappropriate, harmful, or unsuitable for processing. Please review your input and try again with valid study materials.'
            });
        }

        // Extract title and content
        let title = 'Study Notes';
        let content = generatedText;

        // Match the expected format: # Title\n> **Summary:** ...\n---\nContent
        // First try: title followed by summary blockquote then separator
        let titleMatch = generatedText.match(/^#\s+(.+?)[\r\n]+>[\s\S]*?[\r\n]+---[\r\n]+([\s\S]+)/);
        
        if (titleMatch) {
            title = titleMatch[1].trim();
            content = titleMatch[2].trim();
        } else {
            // Second try: title followed by separator
            titleMatch = generatedText.match(/^#\s+(.+?)[\r\n]+---[\r\n]+([\s\S]+)/);
            if (titleMatch) {
                title = titleMatch[1].trim();
                content = titleMatch[2].trim();
            } else {
                // Fallback: try to extract first H1 heading as title
                const h1Match = generatedText.match(/^#\s+(.+?)[\r\n]+([\s\S]+)/);
                if (h1Match) {
                    title = h1Match[1].trim();
                    content = h1Match[2].trim();
                }
            }
        }

        // Process Kroki diagrams (mermaid, plantuml, graphviz, etc.)
        const diagramResult = await processDiagramBlocks(content);
        content = diagramResult.content;
        const diagrams = diagramResult.diagrams;

        // Process image placeholders (search-based)
        const placeholders = extractImagePlaceholders(content);
        const images = [];

        if (placeholders.length > 0) {
            for (const placeholder of placeholders) {
                const searchResults = await searchImages(placeholder.description, 1);
                if (searchResults.length > 0) {
                    images.push({
                        placeholder: placeholder.description,
                        url: searchResults[0].url,
                        position: placeholder.position,
                        type: 'search'
                    });
                }
            }

            // Replace placeholders with actual images
            content = replaceImagePlaceholders(content, images);
        }

        // Combine diagrams and searched images
        const allImages = [
            ...images,
            ...diagrams.map(d => ({ type: 'diagram', diagramType: d.type, url: d.url }))
        ];

        // Save to database
        const material = new Material({
            title,
            content,
            subjectId: subject._id,
            spaceId: subject.spaceId,
            createdBy: req.user._id,
            images: allImages,
            sourceFiles
        });

        await material.save();

        res.json({
            status: 'success',
            material: {
                id: material._id,
                title: material.title,
                content: material.content,
                images: material.images
            }
        });

    } catch (error) {
        if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (cleanupError) {
                    // Ignore cleanup errors
                }
            });
        }

        // Determine appropriate error message and status code
        let statusCode = 500;
        let errorMessage = 'Failed to process files';

        if (error.name === 'ValidationError') {
            statusCode = 400;
            errorMessage = 'Invalid data provided';
        } else if (error.message && error.message.includes('timed out')) {
            statusCode = 504;
            errorMessage = 'Processing took too long. Try with a smaller file or fewer pages.';
        } else if (error.message && error.message.includes('API')) {
            errorMessage = 'AI processing service temporarily unavailable. Please try again later.';
        } else if (error.code === 'ENOSPC') {
            errorMessage = 'Server storage full. Please contact administrator.';
        } else if (error.code === 'ENOENT') {
            errorMessage = 'File system error occurred.';
        }

        res.status(statusCode).json({
            status: 'error',
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get materials for a subject
router.get('/:subjectId', verifyToken, async (req, res) => {
    try {
        // Validate ObjectId format
        if (!req.params.subjectId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ status: 'error', message: 'Invalid subject ID format' });
        }

        const materials = await Material.find({ subjectId: req.params.subjectId })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email');

        res.json({ status: 'success', materials });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch materials' });
    }
});

// Get single material by ID
router.get('/material/:id', verifyToken, async (req, res) => {
    try {
        // Validate ObjectId format
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ status: 'error', message: 'Invalid material ID format' });
        }

        const material = await Material.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('subjectId', 'name');

        if (!material) {
            return res.status(404).json({ status: 'error', message: 'Material not found' });
        }

        res.json({ status: 'success', material });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch material' });
    }
});

// Delete a Material (owner/admin/editor only)
router.delete('/:materialId', verifyToken, async (req, res) => {
    const { materialId } = req.params;

    try {
        // Validate ObjectId format
        if (!materialId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ status: 'error', message: 'Invalid material ID format' });
        }

        const material = await Material.findById(materialId);
        if (!material) {
            return res.status(404).json({ status: 'error', message: 'Material not found' });
        }

        // Check if user has edit permission
        if (!(await canUserEdit(material.spaceId, req.user._id))) {
            return res.status(403).json({ status: 'error', message: 'You do not have permission to delete this material' });
        }

        await Material.findByIdAndDelete(materialId);

        res.json({ status: 'success', message: 'Material deleted successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to delete material' });
    }
});

module.exports = router;
