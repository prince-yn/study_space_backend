const axios = require('axios');

/**
 * Search for images using Google Custom Search API
 * @param {string} query - Search query
 * @param {number} numResults - Number of results to return (default: 1)
 * @returns {Promise<Array>} Array of image URLs
 */
async function searchImages(query, numResults = 1) {
    try {
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
                key: process.env.GOOGLE_API_KEY,
                cx: process.env.GOOGLE_SEARCH_ENGINE_ID,
                q: query,
                searchType: 'image',
                num: numResults,
                safe: 'active'
            }
        });

        if (response.data.items && response.data.items.length > 0) {
            return response.data.items.map(item => ({
                url: item.link,
                title: item.title,
                thumbnail: item.image.thumbnailLink
            }));
        }
        return [];
    } catch (error) {
        console.error('Image search error:', error.message);
        return [];
    }
}

/**
 * Extract image placeholders from markdown content
 * Format: {{IMAGE: description}}
 * @param {string} content - Markdown content
 * @returns {Array} Array of placeholders with positions
 */
function extractImagePlaceholders(content) {
    const regex = /\{\{IMAGE:\s*([^}]+)\}\}/g;
    const placeholders = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
        placeholders.push({
            fullMatch: match[0],
            description: match[1].trim(),
            position: match.index
        });
    }

    return placeholders;
}

/**
 * Replace image placeholders with actual image markdown
 * @param {string} content - Original markdown content
 * @param {Array} images - Array of images with placeholder and URL
 * @returns {string} Updated content with images
 */
function replaceImagePlaceholders(content, images) {
    let updatedContent = content;

    // Sort by position in reverse to maintain correct positions
    images.sort((a, b) => b.position - a.position);

    images.forEach(image => {
        const placeholder = image.placeholder;
        const imageMarkdown = `\n\n![${placeholder}](${image.url})\n\n`;
        updatedContent = updatedContent.replace(`{{IMAGE: ${placeholder}}}`, imageMarkdown);
    });

    return updatedContent;
}

module.exports = {
    searchImages,
    extractImagePlaceholders,
    replaceImagePlaceholders
};
