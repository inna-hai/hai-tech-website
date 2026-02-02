/**
 * Combined Static + API Server for דרך ההייטק
 * Serves static files and proxies lead API requests
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const CONFIG = {
    port: 8080,
    staticDir: __dirname,
    crmEndpoint: 'https://18f95599f0b7.ngrok-free.app/api/webhook/leads',
    apiKey: 'haitech-crm-api-key-2026'
};

// MIME types
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.pdf': 'application/pdf',
    '.xml': 'application/xml'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    
    // CORS headers for API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // API: Lead submission
    if (req.method === 'POST' && pathname === '/api/lead') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const leadData = JSON.parse(body);
                
                // Forward to CRM API
                const crmUrl = new URL(CONFIG.crmEndpoint);
                const options = {
                    hostname: crmUrl.hostname,
                    port: 443,
                    path: crmUrl.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': CONFIG.apiKey
                    }
                };
                
                const crmReq = https.request(options, (crmRes) => {
                    let crmBody = '';
                    crmRes.on('data', chunk => crmBody += chunk);
                    crmRes.on('end', () => {
                        res.writeHead(crmRes.statusCode, { 'Content-Type': 'application/json' });
                        res.end(crmBody);
                        console.log(`[${new Date().toISOString()}] Lead: ${leadData.name} - Status: ${crmRes.statusCode}`);
                    });
                });
                
                crmReq.on('error', (error) => {
                    console.error('CRM error:', error.message);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'CRM connection failed', details: error.message }));
                });
                
                crmReq.write(JSON.stringify(leadData));
                crmReq.end();
                
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    // API: Health check
    if (req.method === 'GET' && pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'hai-tech-server' }));
        return;
    }
    
    // Static file serving
    if (pathname === '/') pathname = '/index.html';
    
    const filePath = path.join(CONFIG.staticDir, pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(CONFIG.staticDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // Try adding .html
                fs.readFile(filePath + '.html', (err2, data2) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>404 - Page Not Found</h1>');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(data2);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

server.listen(CONFIG.port, '0.0.0.0', () => {
    console.log(`🚀 Hai Tech Server running on http://0.0.0.0:${CONFIG.port}`);
    console.log(`📡 API endpoint: /api/lead`);
    console.log(`🔗 CRM: ${CONFIG.crmEndpoint}`);
});
