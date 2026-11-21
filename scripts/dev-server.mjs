import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const MIME_TYPES = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
    ['.webp', 'image/webp'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.ico', 'image/x-icon'],
    ['.woff2', 'font/woff2'],
    ['.mp3', 'audio/mpeg'],
    ['.wav', 'audio/wav'],
    ['.ogg', 'audio/ogg']
]);

export function resolvePublicFile(rootDirectory, requestPath) {
    let pathname;
    try {
        pathname = decodeURIComponent(requestPath.split('?')[0]);
    } catch {
        return null;
    }
    if (pathname.includes('\0') || pathname.includes('\\')) return null;
    // Hidden paths are not game assets and may contain repository metadata or
    // local secrets (.git, .env, editor state). Never expose them over HTTP.
    if (pathname.split('/').some(segment => segment.startsWith('.'))) return null;

    const root = resolve(rootDirectory);
    const candidate = resolve(root, '.' + (pathname.startsWith('/') ? pathname : '/' + pathname));
    const fromRoot = relative(root, candidate);
    if (fromRoot === '..' || fromRoot.startsWith('..' + sep) || isAbsolute(fromRoot)) return null;

    return candidate.endsWith(sep) ? candidate + 'index.html' : candidate;
}

export function createStaticServer(rootDirectory = process.cwd()) {
    const root = resolve(rootDirectory);
    return createServer(async (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { 'Allow': 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Method not allowed');
            return;
        }

        let pathname;
        try {
            pathname = new URL(request.url || '/', 'http://localhost').pathname;
        } catch {
            response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Bad request');
            return;
        }
        const filePath = resolvePublicFile(root, pathname);
        if (!filePath) {
            response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Forbidden');
            return;
        }

        try {
            const info = await stat(filePath);
            const targetPath = info.isDirectory() ? resolve(filePath, 'index.html') : filePath;
            const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(targetPath)]);
            const fromRoot = relative(realRoot, realTarget);
            if (fromRoot === '..' || fromRoot.startsWith('..' + sep) || isAbsolute(fromRoot)) {
                response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                response.end('Forbidden');
                return;
            }
            const body = await readFile(realTarget);
            response.writeHead(200, {
                'Content-Type': MIME_TYPES.get(extname(realTarget).toLowerCase()) || 'application/octet-stream',
                'Content-Length': body.length,
                'X-Content-Type-Options': 'nosniff',
                'Cache-Control': 'no-cache'
            });
            response.end(request.method === 'HEAD' ? undefined : body);
        } catch (error) {
            const missing = error?.code === 'ENOENT' || error?.code === 'EISDIR';
            response.writeHead(missing ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end(missing ? 'Not found' : 'Unable to read file');
        }
    });
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectExecution) {
    const port = Number.parseInt(process.argv[2] || process.env.PORT || '4173', 10);
    const host = process.env.HOST || '127.0.0.1';
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error('Port must be an integer between 1 and 65535.');
        process.exitCode = 1;
    } else {
        const server = createStaticServer();
        server.listen(port, host, () => {
            console.log(`Ghost Signal is available at http://${host}:${port}`);
        });
    }
}
