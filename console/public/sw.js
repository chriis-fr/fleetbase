/* Chains FleetOps console: keeps the start page on the device.
 *
 * A visit is answered from the saved copy at once, and a fresh copy is fetched in the
 * background for next time. When the fresh copy belongs to a new build the open page is
 * told, and it reloads itself if it has only just opened (see app/index.html).
 *
 * Only the start page is handled here. Scripts and styles carry a hash in their name and
 * are already kept by the browser for a year; API calls are never touched.
 */
const SHELL_CACHE = 'console-shell-v1';
const SHELL_KEY = '/__console_shell__';

// The build a page belongs to: the hashed file names it loads. Anything else in the HTML
// (analytics snippets added on the way, for one) may differ between two copies of one build.
const signatureOf = (html) => (html.match(/\/assets\/[^"' >]+/g) || []).join('|');
const isShellPath = (pathname) => !pathname.includes('.') && !pathname.startsWith('/cdn-cgi/');

async function fetchShell(request) {
    const response = await fetch(request, { cache: 'no-store' });
    const type = response.headers.get('content-type') || '';
    if (!response.ok || response.redirected || !type.includes('text/html')) {
        return { response, signature: null };
    }
    const html = await response.clone().text();
    const signature = signatureOf(html);
    return { response, html, signature: signature.includes('/assets/vendor') ? signature : null };
}

async function saveShell(cache, html) {
    await cache.put(SHELL_KEY, new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
}

async function refreshShell(request, cache, saved) {
    const fresh = await fetchShell(request);
    if (!fresh.signature) {
        return fresh.response;
    }
    const savedSignature = saved ? signatureOf(await saved.clone().text()) : null;
    if (fresh.signature !== savedSignature) {
        await saveShell(cache, fresh.html);
        if (savedSignature) {
            const pages = await self.clients.matchAll({ type: 'window' });
            pages.forEach((page) => page.postMessage({ type: 'console-updated', build: fresh.signature.length + ':' + fresh.signature.slice(-80) }));
        }
    }
    return fresh.response;
}

async function shell(event) {
    const cache = await caches.open(SHELL_CACHE);
    const saved = await cache.match(SHELL_KEY);
    const refresh = refreshShell(event.request, cache, saved);
    if (saved) {
        event.waitUntil(refresh.catch(() => {}));
        return saved;
    }
    return refresh;
}

self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(SHELL_CACHE);
            const fresh = await fetchShell('/').catch(() => null);
            if (fresh && fresh.signature) {
                await saveShell(cache, fresh.html);
            }
            await self.skipWaiting();
        })()
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const names = await caches.keys();
            await Promise.all(names.filter((name) => name.startsWith('console-') && name !== SHELL_CACHE).map((name) => caches.delete(name)));
            await self.clients.claim();
        })()
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || request.mode !== 'navigate') {
        return;
    }
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || !isShellPath(url.pathname)) {
        return;
    }
    event.respondWith(shell(event));
});
