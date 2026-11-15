// Service worker : permet d'ouvrir l'app sans réseau.
// Changer VERSION à chaque mise en ligne pour que les téléphones récupèrent la nouvelle version.
const VERSION = 'ap-vino-v8';
const FICHIERS = [
  './', 'index.html', 'styles.css', 'db.js', 'garde.js', 'app.js', 'appellations.js', 'scan.js', 'gemini.js', 'vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js',
  'vendor/tesseract/tesseract-core-lstm.wasm.js', 'vendor/tesseract/tesseract-core-simd-lstm.wasm.js', 'vendor/tesseract/lang/fra.traineddata.gz', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-512-maskable.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// no-cache : vérifie toujours auprès de GitHub si le fichier a changé, sinon le navigateur peut garder l'ancien jusqu'à 10 minutes.
// Réseau d'abord (pour avoir la dernière version), cache si hors-ligne.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((rep) => {
        const copie = rep.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copie));
        return rep;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
