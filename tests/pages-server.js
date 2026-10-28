import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';

const ROOT = 'src/main/resources/web';
const PREFIX = '/tasky';
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml'};

// Serves the web folder under /tasky/ the way GitHub Pages serves a project site.
createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (request.method !== 'GET' || !path.startsWith(PREFIX)) {
        response.writeHead(404).end();
        return;
    }
    const relative = normalize(path.slice(PREFIX.length) || '/');
    const file = join(ROOT, relative.endsWith('/') || relative.endsWith('\\') ? `${relative}index.html` : relative);
    try {
        response.writeHead(200, {'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream'}).end(await readFile(file));
    } catch {
        response.writeHead(404).end();
    }
}).listen(Number(process.argv[2] ?? 8092));
