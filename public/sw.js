// Service worker Quran Community: baca artikel yang pernah dibuka saat offline.
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const MAX_PAGES = 40;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) {
    if (!key.url.endsWith(OFFLINE_URL)) await cache.delete(key);
  }
}

// Halaman publik yang boleh disimpan untuk dibaca offline.
function isCacheablePage(url) {
  return /^\/@[^/]+\/p\/[^/]+$/.test(url.pathname) || url.pathname === "/" || /^\/@[^/]+$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // server action, form, dll. tidak disentuh
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/dasbor") || url.pathname.startsWith("/admin")) return;

  // Aset build Next (nama file ber-hash) & gambar R2: cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/media/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigasi halaman: network-first, simpan artikel, fallback ke cache/offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && isCacheablePage(url)) {
            const cache = await caches.open(PAGES);
            await cache.put(req, res.clone());
            trim(PAGES, MAX_PAGES);
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
  }
});
