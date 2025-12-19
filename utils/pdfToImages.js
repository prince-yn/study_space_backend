const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Convert PDF pages to images using pdftoppm (poppler-utils)
 * Falls back to sending PDF as-is if conversion fails
 */
async function pdfToImages(pdfPath, outputDir) {
    const images = [];
    const baseName = path.basename(pdfPath, '.pdf');
    const outputPrefix = path.join(outputDir, baseName);

    try {
        // Use pdftoppm to convert PDF to images (requires poppler-utils)
        // -png: output PNG format
        // -r 150: 150 DPI resolution (good balance of quality and size)
        await execPromise(`pdftoppm -png -r 150 "${pdfPath}" "${outputPrefix}"`);

        // Find generated images
        const files = fs.readdirSync(outputDir);
        const pngFiles = files
            .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
            .sort();

        for (const pngFile of pngFiles) {
            const imagePath = path.join(outputDir, pngFile);
            const imageData = fs.readFileSync(imagePath);
            images.push({
                path: imagePath,
                data: imageData.toString('base64'),
                mimeType: 'image/png',
                pageNumber: pngFiles.indexOf(pngFile) + 1
            });
        }

        console.log(`Converted PDF to ${images.length} images`);
    } catch (error) {
        console.error('PDF to image conversion failed:', error.message);
        console.log('Falling back to text extraction...');
        // Return empty array - caller will fall back to text extraction
    }

    return images;
}

/**
 * Clean up generated image files
 */
function cleanupImages(images) {
    for (const img of images) {
        try {
            if (img.path && fs.existsSync(img.path)) {
                fs.unlinkSync(img.path);
            }
        } catch (e) {
            console.error('Cleanup error:', e.message);
        }
    }
}

module.exports = { pdfToImages, cleanupImages };
