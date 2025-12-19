const axios = require('axios');
const { model } = require('../config/gemini');

/**
 * Generate an image using Pollinations.ai (free, no API key needed)
 * This is a free text-to-image API that's great for educational diagrams
 */
async function generateImage(prompt, options = {}) {
    const {
        width = 512,
        height = 512,
        seed = Math.floor(Math.random() * 1000000),
        enhance = true
    } = options;

    try {
        // Enhance the prompt for better educational diagrams
        let enhancedPrompt = prompt;
        if (enhance) {
            enhancedPrompt = `Educational diagram: ${prompt}, clean white background, labeled, scientific illustration style, high quality, detailed`;
        }

        // Pollinations.ai free API - generates images from text
        const encodedPrompt = encodeURIComponent(enhancedPrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

        // Verify the URL works by making a HEAD request
        const response = await axios.head(imageUrl, { timeout: 10000 });
        
        if (response.status === 200) {
            return {
                success: true,
                url: imageUrl,
                prompt: prompt,
                enhancedPrompt: enhancedPrompt
            };
        }
    } catch (error) {
        console.error('Image generation error:', error.message);
    }

    return { success: false, error: 'Failed to generate image' };
}

/**
 * Extract image generation requests from content
 * Looks for patterns like {{GENERATE: description}} or {{DIAGRAM: description}}
 */
function extractGenerationRequests(content) {
    const pattern = /\{\{(GENERATE|DIAGRAM|ILLUSTRATION):\s*([^}]+)\}\}/gi;
    const requests = [];
    let match;

    while ((match = pattern.exec(content)) !== null) {
        requests.push({
            fullMatch: match[0],
            type: match[1].toUpperCase(),
            description: match[2].trim(),
            position: match.index
        });
    }

    return requests;
}

/**
 * Process content and generate images for all requests
 */
async function processImageGenerationRequests(content) {
    const requests = extractGenerationRequests(content);
    const generatedImages = [];

    for (const request of requests) {
        console.log(`Generating image for: ${request.description}`);
        
        const result = await generateImage(request.description);
        
        if (result.success) {
            generatedImages.push({
                placeholder: request.fullMatch,
                description: request.description,
                url: result.url,
                type: 'generated'
            });

            // Replace placeholder in content with markdown image
            content = content.replace(
                request.fullMatch,
                `![${request.description}](${result.url})`
            );
        } else {
            // Keep placeholder but add a note
            content = content.replace(
                request.fullMatch,
                `*[Image: ${request.description} - generation pending]*`
            );
        }
    }

    return { content, generatedImages };
}

module.exports = {
    generateImage,
    extractGenerationRequests,
    processImageGenerationRequests
};
