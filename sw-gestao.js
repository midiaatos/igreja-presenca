// Service worker SÓ do app de gestão (escopo "./gestao"): não mexe no app de check-in.
const CACHE = 'atos-gestao-v1';
const ARQUIVOS = ['./gestao.html', './manifest-gestao.json', './gestao-192.png', './gestao-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('atos-gestao-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Servidor (Apps Script), fontes e fotos: vão direto, sem guardar nada
  if(e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Rede primeiro (sempre a versão nova); sem internet, abre a cópia guardada
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {}); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
