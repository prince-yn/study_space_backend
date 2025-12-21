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
const { searchImages, extractImagePlaceholders, replaceImagePlaceholders } = require('../utils/imageSearch');
const { pdfToImages, cleanupImages } = require('../utils/pdfToImages');
const { processImageGenerationRequests } = require('../utils/imageGeneration');

// Scan Notes - Upload files and convert to Markdown with LaTeX
router.post('/create', verifyToken, upload.array('files', 20), async (req, res) => {
    const uploadedFiles = req.files || [];
    const { subjectId, prompt } = req.body;

    try {
        if (!subjectId) {
            return res.status(400).json({ status: 'error', message: 'Subject ID is required' });
        }

        // Verify subject exists and get space ID
        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ status: 'error', message: 'Subject not found' });
        }

        let contentParts = [];
        let sourceFiles = [];

        // Enhanced system prompt with image placeholder instructions
        const systemPrompt = `Analyze the provided content and create structured study notes in Markdown format.

**Requirements:**
1. Use clear headers (##, ###) for organizing topics
2. **CRUCIAL:** Write mathematical formulas using LaTeX syntax:
   - Inline math: $formula$
   - Block math: $$formula$$
3. **Image Placeholders:** 
   - For diagrams you want ME TO SEARCH for: {{IMAGE: description}}
   - For diagrams you want AI TO GENERATE: {{GENERATE: description}}
   Example: {{GENERATE: diagram showing photosynthesis process with labeled chloroplasts}}
4. Keep content accurate and match the source material
5. Only add clarifications if something is unclear or undetectable
6. Create a clear, descriptive title for the notes

Format the response as:
TITLE: [Clear, descriptive title]
---
[Your markdown content with LaTeX and image placeholders]`;

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

        // Extract title and content
        let title = 'Study Notes';
        let content = generatedText;

        const titleMatch = generatedText.match(/^TITLE:\s*(.+?)[\r\n]+---[\r\n]+([\s\S]+)/);
        if (titleMatch) {
            title = titleMatch[1].trim();
            content = titleMatch[2].trim();
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

        res.status(500).json({
            status: 'error',
            message: 'Failed to process files',
            error: error.message
        });
    }
});

// Get materials for a subject
router.get('/:subjectId', verifyToken, async (req, res) => {
    try {
        const materials = await Material.find({ subjectId: req.params.subjectId })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email');

        res.json({ status: 'success', materials });
    } catch (error) {
        console.error("Fetch Materials Error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch materials' });
    }
});

// Get single material by ID
router.get('/material/:id', verifyToken, async (req, res) => {
    try {
        const material = await Material.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('subjectId', 'name');

        if (!material) {
            return res.status(404).json({ status: 'error', message: 'Material not found' });
        }

        res.json({ status: 'success', material });
    } catch (error) {
        console.error("Fetch Material Error:", error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch material' });
    }
});

module.exports = router;
