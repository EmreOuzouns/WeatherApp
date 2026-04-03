const CACHE_NAME = 'weather-app-v18';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './icon.png',
    './manifest.json'
];

// Çalışanım (Service Worker) için kurulum event'imi ayarlıyorum
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Yeni versiyon yüklendiğinde eski önbelleği temizlemek için aktivasyon event'imi tetikliyorum
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        })
    );
});

// Ağ isteklerini ve önbelleğimi kontrol etmek için fetch event'imi dinliyorum
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
