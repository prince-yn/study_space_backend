const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const verifyToken = require('../auth_middleware');
const upload = require('../config/multer');
const { model } = require('../config/gemini');
const Material = require('../models/Material');
const Subject = require('../models/Subject');
const Space = require('../models/Space');
const { searchImages, extractImagePlaceholders, replaceImagePlaceholders } = require('../utils/imageSearch');
const { pdfToImages, cleanupImages } = require('../utils/pdfToImages');
const { processImageGenerationRequests } = require('../utils/imageGeneration');

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
router.post('/create', verifyToken, upload.array('files', 20), async (req, res) => {
    const uploadedFiles = req.files || [];
    const { subjectId, prompt } = req.body;

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

        // Enhanced system prompt with image placeholder instructions
        const systemPrompt = `# Role
You are an expert Academic Assistant specializing in transforming fragmented study materials (rough notes, blackboard photos, or transcripts) into high-quality, student-friendly Markdown notes.

# Task
Analyze the provided input and generate a comprehensive, structured study guide.

# Guidelines
1. **Source Fidelity & Expansion:** Preserve core concepts and specific terminology from the source. However, expand on fragmented thoughts by adding clear definitions, logical explanations, and illustrative examples to ensure the notes are "exam-ready."
2. **Visual Interpretation:** If the input is an image or a description of a blackboard, prioritize capturing the flow of the lecture (e.g., process diagrams, lists, and labeled points).
3. **Structure & Formatting:**
    * Use a clear # Title (H1) for the main topic.
    * Use ## and ### headers for logical hierarchy.
    * Use bullet points for readability.
4. **Mathematical Notation:** Use LaTeX for ALL mathematical or scientific formulas.
    * Inline: $formula$
    * Block: $$formula$$
5. **Diagram Placeholders:**
    * Use {{IMAGE: description}} for standard educational diagrams (e.g., "Human Heart").
    * Use {{GENERATE: description}} for conceptual flowcharts or specific graphs.
6. **Tone & Style:** Maintain a "Helpful Peer" tone—approachable, clear, and easy to read. Avoid overly dense academic jargon unless the jargon is a key term being defined.
7. **Fallback Logic:** If the input is missing or extremely sparse, generate a comprehensive, college-level overview of the identified topic.
8. **Safety:** If the content is inappropriate, harmful, or entirely nonsensical, respond ONLY with "REFUSE".

# Output Format
# [Descriptive Study Title]
---
[Structured Markdown Content]
`;

        contentParts.push(systemPrompt);

        // Process uploaded files
        for (const file of uploadedFiles) {
            const ext = path.extname(file.originalname).toLowerCase();
            const isCloudinary = process.env.USE_CLOUDINARY === 'true';

            sourceFiles.push({
                originalName: file.originalname,
                fileType: ext.includes('pdf') ? 'pdf' : ext.match(/\.(jpg|jpeg|png|gif|webp)/) ? 'image' : 'other',
                size: file.size,
                url: isCloudinary ? file.path : undefined
            });

            if (ext === '.pdf') {
                // For PDFs, we need to download from Cloudinary first if using cloud storage
                let pdfBuffer;
                
                if (isCloudinary) {
                    // Download PDF from Cloudinary URL
                    const axios = require('axios');
                    const response = await axios.get(file.path, { responseType: 'arraybuffer' });
                    pdfBuffer = Buffer.from(response.data);
                } else {
                    // Read from memory buffer or local file
                    pdfBuffer = file.buffer || fs.readFileSync(file.path);
                }

                // Try to extract text first (faster for text-based PDFs)
                const pdfData = await pdfParse(pdfBuffer);
                
                if (pdfData.text && pdfData.text.trim().length > 100) {
                    // Good text extraction - use it
                    contentParts.push({
                        text: `PDF Content from "${file.originalname}":\n${pdfData.text}`
                    });
                } else {
                    // Scanned PDF or no text - note it
                    contentParts.push({
                        text: `PDF "${file.originalname}" has minimal text (possibly scanned). Extracted: ${pdfData.text || 'none'}`
                    });
                }
            } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                // Handle image
                let imageBuffer;
                
                if (isCloudinary) {
                    // Download image from Cloudinary URL
                    const axios = require('axios');
                    const response = await axios.get(file.path, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(response.data);
                } else {
                    // Read from memory buffer or local file
                    imageBuffer = file.buffer || fs.readFileSync(file.path);
                }
                
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

            // Clean up local file only (not Cloudinary)
            if (!isCloudinary && file.path) {
                try {
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.error('Error deleting file:', err.message);
                }
            }
        }

        // Add text prompt if provided
        if (prompt && prompt.trim()) {
            contentParts.push({
                text: `User Prompt: ${prompt}`
            });
        }

        // Check if we have any content
        if (contentParts.length === 1) { // Only system prompt
            return res.status(400).json({ 
                status: 'error', 
                message: 'Please provide at least one file or a text prompt' 
            });
        }

        // Send to Gemini API
        const result = await model.generateContent(contentParts);
        const response = await result.response;
        let generatedText = response.text();

        // Check if AI refused to process content
        if (generatedText.trim() === 'REFUSE' || generatedText.trim().startsWith('REFUSE')) {
            return res.status(400).json({
                status: 'error',
                message: 'The provided content was deemed inappropriate, harmful, or unsuitable for processing. Please review your input and try again with valid study materials.'
            });
        }

        // Extract title and content
        let title = 'Study Notes';
        let content = generatedText;

        // Match the expected format: # Title\n---\nContent
        const titleMatch = generatedText.match(/^#\s+(.+?)[\r\n]+---[\r\n]+([\s\S]+)/);
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

        // Process image placeholders (search-based)
        const placeholders = extractImagePlaceholders(content);
        const images = [];

        if (placeholders.length > 0) {
            console.log(`Found ${placeholders.length} image search placeholders`);
            
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

        // Process AI-generated images
        const generationResult = await processImageGenerationRequests(content);
        content = generationResult.content;
        const generatedImages = generationResult.generatedImages;

        // Combine all images
        const allImages = [...images, ...generatedImages];

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
        console.error("Scan Notes Error:", error);

        // Clean up files if they exist
        if (uploadedFiles && uploadedFiles.length > 0) {
            uploadedFiles.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (cleanupError) {
                    console.error("Cleanup Error:", cleanupError);
                }
            });
        }

        // Determine appropriate error message and status code
        let statusCode = 500;
        let errorMessage = 'Failed to process files';

        if (error.name === 'ValidationError') {
            statusCode = 400;
            errorMessage = 'Invalid data provided';
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
        console.error("Fetch Materials Error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch materials', details: error.message });
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
        console.error("Fetch Material Error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch material', details: error.message });
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
        console.error("Delete Material Error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to delete material', details: error.message });
    }
});

module.exports = router;
