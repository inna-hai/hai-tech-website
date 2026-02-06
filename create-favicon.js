const fs = require('fs');
const path = require('path');

// Create a simple favicon as SVG
const faviconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#8BC34A"/>
      <stop offset="100%" style="stop-color:#CDDC39"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="6" fill="#1a1a2e"/>
  <!-- Robot face -->
  <rect x="6" y="10" width="20" height="14" rx="3" fill="url(#grad)"/>
  <rect x="9" y="4" width="14" height="8" rx="2" fill="url(#grad)"/>
  <circle cx="12" cy="16" r="2.5" fill="#1a1a2e"/>
  <circle cx="20" cy="16" r="2.5" fill="#1a1a2e"/>
  <rect x="2" y="14" width="4" height="5" rx="1" fill="url(#grad)"/>
  <rect x="26" y="14" width="4" height="5" rx="1" fill="url(#grad)"/>
</svg>`;

fs.writeFileSync(path.join(__dirname, 'images/brand/favicon.svg'), faviconSvg);
console.log('Favicon SVG created');
