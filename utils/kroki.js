const axios = require('axios');
const zlib = require('zlib');
const cloudinary = require('../config/cloudinary');
const crypto = require('crypto');
const { Readable } = require('stream');

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
function getDiagramUrl(type, source, format = 'png') {
    const diagramType = DIAGRAM_TYPES[type.toLowerCase()] || type.toLowerCase();
    const encoded = encodeDiagramSource(source);
    return `${KROKI_BASE_URL}/${diagramType}/${format}/${encoded}`;
}

/**
 * Sanitize mermaid diagram source to fix common syntax issues
 * @param {string} source - Raw mermaid source
 * @returns {string} Sanitized source
 */
function sanitizeMermaidSource(source) {
    let cleaned = source.trim();
    
    // Replace smart quotes and apostrophes with safe alternatives
    cleaned = cleaned
        .replace(/[\u2018\u2019]/g, '') // Remove smart single quotes
        .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
        .replace(/'/g, '')  // Remove apostrophes (they break mermaid node labels)
        .replace(/`/g, ''); // Remove backticks
    
    // Fix missing line breaks between mermaid statements
    // When a ] or } or ) is followed by 2+ spaces and then a new node definition, insert a newline
    cleaned = cleaned.replace(
        /([}\]\)])(\s{2,})([A-Za-z_][A-Za-z0-9_]*(?:\[|\{|\())/g,
        '$1\n    $3'
    );
    
    // Ensure each statement line ends with a semicolon (required for proper parsing)
    cleaned = cleaned.split('\n').map(line => {
        const trimmed = line.trim();
        // Skip empty lines, declarations, and lines that already end properly
        if (!trimmed || 
            trimmed.startsWith('graph ') || 
            trimmed.startsWith('flowchart ') ||
            trimmed.startsWith('sequenceDiagram') ||
            trimmed.startsWith('classDiagram') ||
            trimmed.startsWith('stateDiagram') ||
            trimmed.startsWith('erDiagram') ||
            trimmed.startsWith('gantt') ||
            trimmed.startsWith('pie') ||
            trimmed.startsWith('subgraph ') ||
            trimmed === 'end' ||
            trimmed.endsWith(';') ||
            trimmed.endsWith('{') ||
            trimmed.endsWith(':')) {
            return line;
        }
        // If line contains a connection (-->, ---, ---|, -.->, etc.), add semicolon
        if (/-->|---|--\||-.->|\|>|<\|/.test(trimmed)) {
            return line + ';';
        }
        return line;
    }).join('\n');
    
    return cleaned;
}

/**
 * Upload a buffer to Cloudinary
 * @param {Buffer} buffer - Image buffer to upload
 * @param {string} folder - Cloudinary folder
 * @param {string} publicId - Public ID for the image
 * @returns {Promise<{url: string, publicId: string}>}
 */
async function uploadToCloudinary(buffer, folder = 'diagrams', publicId = null) {
    return new Promise((resolve, reject) => {
        const uploadOptions = {
            folder: folder,
            resource_type: 'image',
            format: 'png',
        };
        
        if (publicId) {
            uploadOptions.public_id = publicId;
        }
        
        const uploadStream = cloudinary.v2.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id
                    });
                }
            }
        );
        
        // Convert buffer to stream and pipe to Cloudinary
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);
        bufferStream.pipe(uploadStream);
    });
}

/**
 * Generate a diagram using Kroki API and upload to Cloudinary
 * @param {string} type - Diagram type
 * @param {string} source - Diagram source code
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function generateDiagram(type, source) {
    try {
        const diagramType = DIAGRAM_TYPES[type.toLowerCase()] || type.toLowerCase();
        
        let cleanedSource = source.trim();
        
        if (!cleanedSource) {
            return {
                success: false,
                error: 'Empty diagram source'
            };
        }
        
        // Sanitize mermaid diagrams
        if (diagramType === 'mermaid') {
            cleanedSource = sanitizeMermaidSource(cleanedSource);
        }
        
        console.log(`Generating ${diagramType} diagram as PNG...`);
        
        // Generate PNG using Kroki API
        const response = await axios.post(
            `${KROKI_BASE_URL}/${diagramType}/png`,
            cleanedSource,
            {
                headers: {
                    'Content-Type': 'text/plain'
                },
                responseType: 'arraybuffer', // Get binary data
                timeout: 30000,
                validateStatus: (status) => status < 500
            }
        );
        
        // Check if request was successful
        if (response.status >= 400) {
            const errorText = Buffer.from(response.data).toString('utf-8');
            const errorMessage = errorText.substring(0, 300);
            console.error(`Kroki error (${response.status}):`, errorMessage);
            return {
                success: false,
                error: `Diagram syntax error: ${errorMessage}`
            };
        }
        
        // Upload PNG to Cloudinary
        const pngBuffer = Buffer.from(response.data);
        console.log(`Uploading ${diagramType} diagram to Cloudinary (${pngBuffer.length} bytes)...`);
        
        // Generate a unique ID based on content hash
        const hash = crypto.createHash('md5').update(cleanedSource).digest('hex').substring(0, 12);
        const publicId = `diagram_${diagramType}_${hash}`;
        
        const cloudinaryResult = await uploadToCloudinary(pngBuffer, 'study_space/diagrams', publicId);
        
        console.log(`Diagram uploaded successfully: ${cloudinaryResult.url}`);
        
        return {
            success: true,
            url: cloudinaryResult.url,
            publicId: cloudinaryResult.publicId,
            type: diagramType,
            format: 'png'
        };
        
    } catch (error) {
        const errorMessage = error.response?.data 
            ? (Buffer.isBuffer(error.response.data) 
                ? Buffer.from(error.response.data).toString('utf-8').substring(0, 200)
                : error.message)
            : error.message;
        console.error(`Diagram generation error (${type}):`, errorMessage);
        return {
            success: false,
            error: errorMessage
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
 * Process content and convert all diagram blocks to Cloudinary image URLs
 * @param {string} content - Markdown content with diagram blocks
 * @returns {Promise<{content: string, diagrams: Array}>}
 */
async function processDiagramBlocks(content) {
    const diagramBlocks = extractDiagramBlocks(content);
    const processedDiagrams = [];
    
    if (diagramBlocks.length === 0) {
        return { content, diagrams: [] };
    }
    
    console.log(`Found ${diagramBlocks.length} diagram(s) to process...`);
    
    // Sort by position in reverse to maintain correct positions during replacement
    diagramBlocks.sort((a, b) => b.position - a.position);
    
    for (const block of diagramBlocks) {
        console.log(`Processing ${block.type} diagram (${block.source.length} chars)...`);
        
        const result = await generateDiagram(block.type, block.source);
        
        if (result.success) {
            processedDiagrams.push({
                type: block.type,
                url: result.url,
                publicId: result.publicId,
                source: block.source
            });
            
            // Replace the code block with a markdown image
            const altText = `${block.type} diagram`;
            content = content.replace(
                block.fullMatch,
                `![${altText}](${result.url})`
            );
            
            console.log(`✓ ${block.type} diagram rendered and uploaded successfully`);
        } else {
            console.error(`✗ Failed to render ${block.type} diagram:`, result.error);
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
    sanitizeMermaidSource,
    uploadToCloudinary,
    DIAGRAM_TYPES
};
