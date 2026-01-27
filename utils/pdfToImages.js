const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);


async function pdfToImages(pdfPath, outputDir) {
    const images = [];
    const baseName = path.basename(pdfPath, '.pdf');
    const outputPrefix = path.join(outputDir, baseName);

    try {
        
        
        
        await execPromise(`pdftoppm -png -r 150 "${pdfPath}" "${outputPrefix}"`);

        
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

    } catch (error) {
        
    }

    return images;
}


function cleanupImages(images) {
    for (const img of images) {
        try {
            if (img.path && fs.existsSync(img.path)) {
                fs.unlinkSync(img.path);
            }
        } catch (e) {
            
        }
    }
}

module.exports = { pdfToImages, cleanupImages };
