/**
 * Lead Proxy Server - Bypasses CORS for CRM API
 * דרך ההייטק
 */

const http = require('http');
const https = require('https');
const url = require('url');

const CONFIG = {
    port: 8081,
    crmEndpoint: 'https://18f95599f0b7.ngrok-free.app/api/webhook/leads',
    apiKey: 'haitech-crm-api-key-2026',
    allowedOrigins: ['http://129.159.135.204:8080', 'http://localhost:8080', 'https://hai.tech', 'http://hai.tech']
};

const server = http.createServer((req, res) => {
    // CORS headers
    const origin = req.headers.origin;
    if (CONFIG.allowedOrigins.includes(origin) || !origin) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Only handle POST to /lead
    if (req.method === 'POST' && req.url === '/lead') {
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
                        console.log(`[${new Date().toISOString()}] Lead forwarded: ${leadData.name} - Status: ${crmRes.statusCode}`);
                    });
                });
                
                crmReq.on('error', (error) => {
                    console.error('CRM request error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to forward to CRM' }));
                });
                
                crmReq.write(JSON.stringify(leadData));
                crmReq.end();
                
            } catch (error) {
                console.error('Parse error:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        // Health check
        if (req.method === 'GET' && req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', service: 'lead-proxy' }));
            return;
        }
        
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(CONFIG.port, () => {
    console.log(`Lead Proxy Server running on port ${CONFIG.port}`);
    console.log(`Forwarding leads to: ${CONFIG.crmEndpoint}`);
});
