const axios = require('axios');
const cloudinary = require('../config/cloudinary');

/**
 * Sleep helper for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate an image using Pollinations.ai (free, no API key required)
 * and upload to Cloudinary, with retry logic for 502 errors
 */
async function generateImage(prompt, options = {}) {
    const { enhance = true, maxRetries = 3, retryDelay = 2000 } = options;

    // Enhance the prompt for better educational diagrams
    let enhancedPrompt = prompt;
    if (enhance) {
        enhancedPrompt = `Educational diagram: ${prompt}, clean white background, labeled, scientific illustration style, high quality, detailed`;
    }

    // Retry loop
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Generate image using Pollinations.ai
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}`;
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'StudySpace/1.0'
                }
            });

            const buffer = Buffer.from(response.data, 'binary');

            // Upload to Cloudinary if enabled
            if (process.env.USE_CLOUDINARY === 'true') {
                const uploadResult = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'study_space/generated',
                            resource_type: 'image',
                            format: 'png'
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result);
                        }
                    );
                    uploadStream.end(buffer);
                });

                console.log(`Generated image uploaded to Cloudinary: ${uploadResult.secure_url}`);
                
                return {
                    success: true,
                    url: uploadResult.secure_url,
                    prompt: prompt,
                    enhancedPrompt: enhancedPrompt
                };
            } else {
                // Fallback: return base64 data URL (not recommended for production)
                const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
                console.warn('Cloudinary not enabled, using base64 data URL');
                
                return {
                    success: true,
                    url: dataUrl,
                    prompt: prompt,
                    enhancedPrompt: enhancedPrompt
                };
            }
        } catch (error) {
            const is502 = error.response?.status === 502;
            const isLastAttempt = attempt === maxRetries;

            if (is502 && !isLastAttempt) {
                console.log(`Image generation failed (502), retrying (${attempt}/${maxRetries})...`);
                await sleep(retryDelay);
                continue;
            }

            // Log and return error on last attempt or non-502 errors
            console.error(`Image generation error (attempt ${attempt}/${maxRetries}):`, error.message);
            return { success: false, error: error.message };
        }
    }
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
