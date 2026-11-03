// Service worker de Cauce — solo para que la app sea INSTALABLE (PWA).
// No guarda nada en caché a propósito: sin conexión no hay datos que mostrar, y así
// nunca se ve información financiera vieja. El modo offline queda para una fase posterior.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpia cualquier caché de versiones anteriores
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Pasa las navegaciones directo a la red (requisito de instalabilidad en algunos navegadores).
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request));
  }
});
