const fs = require('fs');
const path = require('path');

// Read the PDF file
const pdfPath = path.join(__dirname, 'images/brand/logo-haitech.pdf');
const pdfContent = fs.readFileSync(pdfPath, 'utf8');

// Find the base64 thumbnail in XMP metadata
const thumbnailMatch = pdfContent.match(/<xmpGImg:image>([^<]+)<\/xmpGImg:image>/);

if (thumbnailMatch) {
    // Clean the base64 data (remove XML entities like &#xA;)
    const base64Data = thumbnailMatch[1].replace(/&#xA;/g, '').replace(/\s+/g, '');
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Save as JPEG
    const outputPath = path.join(__dirname, 'images/brand/logo-thumbnail.jpg');
    fs.writeFileSync(outputPath, imageBuffer);
    
    console.log('Thumbnail extracted to:', outputPath);
    console.log('Size:', imageBuffer.length, 'bytes');
} else {
    console.log('No thumbnail found in PDF');
}
