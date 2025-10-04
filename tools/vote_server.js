const http = require('http');
const { spawn } = require('child_process');
const url = require('url');
const path = require('path');

const PORT = process.env.PORT || 3456;

const server = http.createServer((req, res) => {
    const parsed = url.parse(req.url, true);
    if (req.method === 'POST' && parsed.pathname === '/vote') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const unit = data.unit;
                const delta = parseInt(data.delta, 10) || 0;
                if (!unit || (delta !== 1 && delta !== -1)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'invalid payload' }));
                    return;
                }

                // Call apply_vote_to_xlsx with workbook path and delta
                const script = path.join(__dirname, 'apply_vote_to_xlsx.js');
                const args = [path.join(__dirname, '..', 'UnitTierList.xlsx'), unit, String(delta)];
                const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
                let out = '';
                child.stdout.on('data', d => out += d.toString());
                child.stderr.on('data', d => out += d.toString());
                child.on('close', code => {
                    let parsed = null;
                    try { parsed = JSON.parse(out); } catch (e) { /* not JSON */ }
                    if (code === 0) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, result: parsed || out }));
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, code, out }));
                    }
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid json' }));
            }
        });
        return;
    }
    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => console.log(`Vote server listening on http://localhost:${PORT}`));
