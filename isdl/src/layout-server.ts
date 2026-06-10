import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LayoutServerOptions {
    port: number;
    workspaceDir: string;
    onSaved?: (id: string, layoutPath: string) => void;
}

export interface LayoutServer {
    port: number;
    stop(): void;
}

/**
 * Find the directory containing the .isdl file with `id = "..."` matching the given id.
 * Searches workspaceDir recursively (up to 3 levels deep) for .isdl files.
 */
function findIsdlDir(workspaceDir: string, id: string): string | null {
    const idPattern = new RegExp(`id\\s*=\\s*["']${escapeRegex(id)}["']`);

    function scanDir(dir: string, depth: number): string | null {
        if (depth > 3) return null;
        let entries: string[];
        try {
            entries = fs.readdirSync(dir);
        } catch {
            return null;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry);
            let stat: fs.Stats;
            try {
                stat = fs.statSync(full);
            } catch {
                continue;
            }
            if (stat.isFile() && (entry.endsWith('.isdl') || entry.endsWith('.fsdl'))) {
                try {
                    const content = fs.readFileSync(full, 'utf8');
                    if (idPattern.test(content)) return dir;
                } catch {
                    // skip unreadable files
                }
            } else if (stat.isDirectory()) {
                const found = scanDir(full, depth + 1);
                if (found) return found;
            }
        }
        return null;
    }

    return scanDir(workspaceDir, 0);
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(payload);
}

export function createLayoutServer(options: LayoutServerOptions): Promise<LayoutServer> {
    const { port, workspaceDir, onSaved } = options;

    const server = http.createServer(async (req, res) => {
        // CORS preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            });
            res.end();
            return;
        }

        if (req.method === 'GET' && req.url === '/status') {
            sendJson(res, 200, { ok: true, workspace: workspaceDir });
            return;
        }

        if (req.method === 'POST' && req.url === '/layout') {
            let body: string;
            try {
                body = await readBody(req);
            } catch {
                sendJson(res, 400, { error: 'Failed to read request body' });
                return;
            }

            let payload: { id: string; layout: unknown };
            try {
                payload = JSON.parse(body);
            } catch {
                sendJson(res, 400, { error: 'Invalid JSON' });
                return;
            }

            const { id, layout } = payload;
            if (!id || typeof id !== 'string' || !layout || typeof layout !== 'object') {
                sendJson(res, 400, { error: 'Body must be { id: string, layout: object }' });
                return;
            }

            const isdlDir = findIsdlDir(workspaceDir, id);
            if (!isdlDir) {
                sendJson(res, 404, { error: `No .isdl file with id="${id}" found in workspace` });
                return;
            }

            const layoutPath = path.join(isdlDir, `${id}-layout.json`);
            try {
                fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2), 'utf8');
            } catch (e) {
                sendJson(res, 500, { error: `Failed to write layout file: ${e}` });
                return;
            }

            onSaved?.(id, layoutPath);
            sendJson(res, 200, { ok: true, path: layoutPath });
            return;
        }

        sendJson(res, 404, { error: 'Not found' });
    });

    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            resolve({
                port,
                stop() {
                    server.close();
                },
            });
        });
    });
}
