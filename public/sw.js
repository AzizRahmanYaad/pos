/*
 * The service worker that lets the shop keep working with no internet.
 *
 * It deliberately does not touch /api. Data caching and the queue of
 * unsent changes live in the application, in IndexedDB, where they can be
 * scoped to the signed-in user and shown honestly on screen. A service
 * worker quietly answering an API call from a cache would be indis-
 * tinguishable, to the cashier, from the sale having actually gone
 * through — so it does not do that.
 *
 * What it does own is the application itself: the HTML shell and the
 * hashed JS/CSS/font bundles, without which there is nothing to run.
 */

const CACHE = 'asan-hesab-shell-v1';
const MANIFEST = '/build/manifest.json';

/** Everything the app needs on a cold, offline start. */
async function precache() {
    const cache = await caches.open(CACHE);

    // The bundles are content-hashed, so their names are only knowable by
    // reading the build manifest — which is exactly what the page does.
    try {
        const response = await fetch(MANIFEST, { cache: 'no-store' });

        if (response.ok) {
            const manifest = await response.json();
            const assets = new Set();

            for (const entry of Object.values(manifest)) {
                if (entry.file) assets.add(`/build/${entry.file}`);
                for (const css of entry.css ?? []) assets.add(`/build/${css}`);
                for (const asset of entry.assets ?? []) assets.add(`/build/${asset}`);
            }

            // One failure (a font that moved) must not abandon the rest.
            await Promise.all(
                [...assets].map((url) => cache.add(url).catch(() => undefined)),
            );
        }
    } catch {
        // No network at install time. The runtime handlers below will fill
        // the cache as soon as there is one.
    }

    await Promise.all(
        ['/', '/favicon.svg'].map((url) => cache.add(url).catch(() => undefined)),
    );
}

self.addEventListener('install', (event) => {
    event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const names = await caches.keys();
            await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
            await self.clients.claim();
        })(),
    );
});

/** Hashed assets never change under their own name, so the cache is truth. */
async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);

    if (hit) return hit;

    const response = await fetch(request);

    if (response.ok) cache.put(request, response.clone());

    return response;
}

/**
 * The shell is fetched fresh whenever there is a network, so a deploy is
 * picked up on the next load exactly as before. The cached copy is the
 * fallback for when there is not.
 */
async function shellNetworkFirst(request) {
    const cache = await caches.open(CACHE);

    try {
        const response = await fetch(request);

        if (response.ok) {
            // Store under '/' so any route can be opened cold while offline.
            cache.put('/', response.clone());
        }

        return response;
    } catch (error) {
        const cached = (await cache.match('/')) ?? (await cache.match(request));

        if (cached) return cached;

        throw error;
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;

    // The application's own business — see the note at the top.
    if (url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(shellNetworkFirst(request));

        return;
    }

    if (url.pathname.startsWith('/build/') || url.pathname.startsWith('/storage/')) {
        event.respondWith(cacheFirst(request));
    }
});

// Lets the page ask a waiting worker to take over immediately after a deploy.
self.addEventListener('message', (event) => {
    if (event.data === 'skip-waiting') self.skipWaiting();
});
