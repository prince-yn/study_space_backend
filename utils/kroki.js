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
 * Generate a diagram using Kroki API (POST method for reliability)
 * @param {string} type - Diagram type
 * @param {string} source - Diagram source code
 * @param {string} format - Output format
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function generateDiagram(type, source, format = 'svg') {
    try {
        const diagramType = DIAGRAM_TYPES[type.toLowerCase()] || type.toLowerCase();
        
        // Clean up the source - remove any problematic characters
        let cleanedSource = source.trim();
        
        if (!cleanedSource) {
            return {
                success: false,
                error: 'Empty diagram source'
            };
        }
        
        // For mermaid diagrams, sanitize special characters in node labels
        if (diagramType === 'mermaid') {
            // Replace smart quotes and apostrophes with safe alternatives
            cleanedSource = cleanedSource
                .replace(/[\u2018\u2019]/g, '') // Remove smart single quotes
                .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
                .replace(/'/g, '')  // Remove apostrophes (they break mermaid node labels)
                .replace(/`/g, ''); // Remove backticks
            
            // Fix missing line breaks between mermaid statements
            // When a ] is followed by 2+ spaces and then a new node definition, insert a newline
            // This handles cases like: "A[label] --- B[label]    C[label] --- D"
            // which should be: "A[label] --- B[label]\n    C[label] --- D"
            cleanedSource = cleanedSource.replace(
                /\](\s{2,})([A-Za-z_][A-Za-z0-9_]*(?:\[|\{|\())/g,
                ']\n    $2'
            );
            
            // Ensure each line ends with a semicolon (required for proper parsing with special chars)
            // Split by lines, add semicolon if line contains a connection and doesn't end with ; or {
            cleanedSource = cleanedSource.split('\n').map(line => {
                const trimmed = line.trim();
                // Skip empty lines, graph declarations, and subgraph/end lines
                if (!trimmed || 
                    trimmed.startsWith('graph ') || 
                    trimmed.startsWith('flowchart ') ||
                    trimmed.startsWith('subgraph ') ||
                    trimmed === 'end' ||
                    trimmed.endsWith(';') ||
                    trimmed.endsWith('{')) {
                    return line;
                }
                // If line contains a connection (-->, ---, ---|, etc.), add semicolon
                if (/-->|---|\|/.test(trimmed)) {
                    return line + ';';
                }
                return line;
            }).join('\n');
        }
        
        // Always use POST method for reliability (avoids URL encoding issues)
        const response = await axios.post(
            `${KROKI_BASE_URL}/${diagramType}/${format}`,
            cleanedSource,
            {
                headers: {
                    'Content-Type': 'text/plain'
                },
                timeout: 30000,
                validateStatus: (status) => status < 500 // Don't throw on 4xx errors
            }
        );
        
        // Check if request was successful
        if (response.status >= 400) {
            const errorMessage = typeof response.data === 'string' 
                ? response.data.substring(0, 200) 
                : 'Invalid diagram syntax';
            return {
                success: false,
                error: `Diagram syntax error: ${errorMessage}`
            };
        }
        
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
        const errorMessage = error.response?.data 
            ? (typeof error.response.data === 'string' ? error.response.data.substring(0, 200) : error.message)
            : error.message;
        console.error(`Kroki diagram generation error (${type}):`, errorMessage);
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
        console.log(`Processing ${block.type} diagram (${block.source.length} chars)...`);
        
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
            console.error(`Failed to render ${block.type} diagram. Source preview:`, block.source.substring(0, 200));
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
