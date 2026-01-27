const axios = require('axios');


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
        return [];
    }
}


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


function replaceImagePlaceholders(content, images) {
    let updatedContent = content;

    
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
