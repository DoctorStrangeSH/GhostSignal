import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createStaticServer, resolvePublicFile } from '../scripts/dev-server.mjs';

test('static server safely serves files, directory indexes and common MIME types', async t => {
    const root = await mkdtemp(join(tmpdir(), 'ghost-signal-server-'));
    const outside = await mkdtemp(join(tmpdir(), 'ghost-signal-outside-'));
    const server = createStaticServer(root);
    await mkdir(join(root, 'assets'));
    await writeFile(join(root, 'index.html'), '<main>Ghost Signal</main>');
    await writeFile(join(root, 'assets', 'app.css'), 'body { color: black; }');
    await writeFile(join(outside, 'secret.txt'), 'not public');
    await symlink(join(outside, 'secret.txt'), join(root, 'secret-link.txt'));

    t.after(async () => {
        await new Promise(resolveClose => server.close(resolveClose));
        await rm(root, { recursive: true, force: true });
        await rm(outside, { recursive: true, force: true });
    });

    await new Promise((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolveListen);
    });
    const address = server.address();
    const base = `http://127.0.0.1:${address.port}`;

    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Ghost Signal/);

    const css = await fetch(base + '/assets/app.css');
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);

    const head = await fetch(base + '/index.html', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');

    const missing = await fetch(base + '/missing.js');
    assert.equal(missing.status, 404);

    const forbidden = await fetch(base + '/secret-link.txt');
    assert.equal(forbidden.status, 403);

    const method = await fetch(base + '/index.html', { method: 'POST' });
    assert.equal(method.status, 405);
});

test('request path resolver rejects traversal and malformed encoding', () => {
    const root = resolve('/tmp/ghost-signal-root');
    assert.equal(resolvePublicFile(root, '/index.html'), join(root, 'index.html'));
    assert.equal(resolvePublicFile(root, '/%2e%2e/secret.txt'), null);
    assert.equal(resolvePublicFile(root, '/%E0%A4%A'), null);
});
