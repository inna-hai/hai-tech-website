const fs = require('fs');
const src = '/home/ameidar/.openclaw/media/inbound/file_54---13f1c2e3-db2e-48ae-ab2a-5cbe1c793a08.jpg';
const dest = './images/brand/logo.jpg';
fs.copyFileSync(src, dest);
console.log('Logo copied to', dest);
