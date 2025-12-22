const axios = require('axios');
const zlib = require('zlib');

const KROKI_BASE_URL = 'https://kroki.io';

/**
 * Supported diagram types in Kroki
 */
const DIAGRAM_TYPES = {
    // Most commonly used
    'mermaid': 'mermaid',
    'plantuml': 'plantuml',
    'graphviz': 'graphviz',
    'dot': 'graphviz',
    'd2': 'd2',
    'excalidraw': 'excalidraw',
    
    // Additional types
    'blockdiag': 'blockdiag',
    'seqdiag': 'seqdiag',
    'actdiag': 'actdiag',
    'nwdiag': 'nwdiag',
    'packetdiag': 'packetdiag',
    'rackdiag': 'rackdiag',
    'c4plantuml': 'c4plantuml',
    'ditaa': 'ditaa',
    'erd': 'erd',
    'nomnoml': 'nomnoml',
    'pikchr': 'pikchr',
    'structurizr': 'structurizr',
    'svgbob': 'svgbob',
    'vega': 'vega',
    'vegalite': 'vegalite',
    'wavedrom': 'wavedrom',
    'wireviz': 'wireviz'
};

/**
 * Encode diagram source for Kroki URL
 * Uses deflate compression + base64 URL-safe encoding
 */
function encodeDiagramSource(source) {
    const compressed = zlib.deflateSync(source);
    // Convert to base64 URL-safe format
    return compressed.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Generate a Kroki diagram URL
 * @param {string} type - Diagram type (mermaid, plantuml, graphviz, etc.)
 * @param {string} source - Diagram source code
 * @param {string} format - Output format (svg, png, pdf)
 * @returns {string} Kroki URL for the diagram
 */
function getDiagramUrl(type, source, format = 'svg') {
    const diagramType = DIAGRAM_TYPES[type.toLowerCase()] || type.toLowerCase();
    const encoded = encodeDiagramSource(source);
    return `${KROKI_BASE_URL}/${diagramType}/${format}/${encoded}`;
}

/**
 * Generate a diagram using Kroki API (POST method for larger diagrams)
 * @param {string} type - Diagram type
 * @param {string} source - Diagram source code
 * @param {string} format - Output format
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function generateDiagram(type, source, format = 'svg') {
    try {
        const diagramType = DIAGRAM_TYPES[type.toLowerCase()] || type.toLowerCase();
        
        // For smaller diagrams, use the URL method (faster, cacheable)
        if (source.length < 2000) {
            const url = getDiagramUrl(type, source, format);
            
            // Validate the diagram by making a HEAD request
            await axios.head(url, { timeout: 10000 });
            
            return {
                success: true,
                url: url,
                type: diagramType,
                format: format
            };
        }
        
        // For larger diagrams, use POST API
        const response = await axios.post(
            `${KROKI_BASE_URL}/${diagramType}/${format}`,
            source,
            {
                headers: {
                    'Content-Type': 'text/plain'
                },
                timeout: 30000
            }
        );
        
        // Convert response to data URL for larger diagrams
        if (format === 'svg') {
            const svgContent = response.data;
            const base64 = Buffer.from(svgContent).toString('base64');
            return {
                success: true,
                url: `data:image/svg+xml;base64,${base64}`,
                type: diagramType,
                format: format
            };
        }
        
        return {
            success: true,
            url: getDiagramUrl(type, source, format),
            type: diagramType,
            format: format
        };
        
    } catch (error) {
        console.error(`Kroki diagram generation error (${type}):`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Extract diagram code blocks from content
 * Looks for ```mermaid, ```plantuml, ```graphviz, etc.
 * Also handles {{DIAGRAM:type\n...code...\n}} format
 */
function extractDiagramBlocks(content) {
    const diagrams = [];
    
    // Pattern 1: Fenced code blocks with diagram type
    // ```mermaid ... ``` or ```plantuml ... ```
    const codeBlockPattern = /```(mermaid|plantuml|graphviz|dot|d2|blockdiag|seqdiag|actdiag|nwdiag|ditaa|erd|nomnoml|pikchr|svgbob|vega|vegalite|wavedrom)\n([\s\S]*?)```/gi;
    
    let match;
    while ((match = codeBlockPattern.exec(content)) !== null) {
        diagrams.push({
            fullMatch: match[0],
            type: match[1].toLowerCase(),
            source: match[2].trim(),
            position: match.index
        });
    }
    
    // Pattern 2: {{DIAGRAM:type ... }} format for inline diagrams
    const inlinePattern = /\{\{DIAGRAM:(\w+)\n([\s\S]*?)\}\}/gi;
    
    while ((match = inlinePattern.exec(content)) !== null) {
        diagrams.push({
            fullMatch: match[0],
            type: match[1].toLowerCase(),
            source: match[2].trim(),
            position: match.index
        });
    }
    
    return diagrams;
}

/**
 * Process content and convert all diagram blocks to Kroki URLs
 * @param {string} content - Markdown content with diagram blocks
 * @returns {Promise<{content: string, diagrams: Array}>}
 */
async function processDiagramBlocks(content) {
    const diagramBlocks = extractDiagramBlocks(content);
    const processedDiagrams = [];
    
    // Sort by position in reverse to maintain correct positions during replacement
    diagramBlocks.sort((a, b) => b.position - a.position);
    
    for (const block of diagramBlocks) {
        console.log(`Processing ${block.type} diagram...`);
        
        const result = await generateDiagram(block.type, block.source, 'svg');
        
        if (result.success) {
            processedDiagrams.push({
                type: block.type,
                url: result.url,
                source: block.source
            });
            
            // Replace the code block with an image
            const altText = `${block.type} diagram`;
            content = content.replace(
                block.fullMatch,
                `![${altText}](${result.url})`
            );
        } else {
            // Keep the code block but add an error note
            content = content.replace(
                block.fullMatch,
                `${block.fullMatch}\n\n*⚠️ Diagram rendering failed: ${result.error}*`
            );
        }
    }
    
    return { content, diagrams: processedDiagrams };
}

/**
 * Get available diagram types
 */
function getAvailableDiagramTypes() {
    return Object.keys(DIAGRAM_TYPES);
}

module.exports = {
    getDiagramUrl,
    generateDiagram,
    extractDiagramBlocks,
    processDiagramBlocks,
    getAvailableDiagramTypes,
    DIAGRAM_TYPES
};
