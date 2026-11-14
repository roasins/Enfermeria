// Service worker mínimo: permite instalar la app y abrirla rápido.
// Los datos (Supabase) SIEMPRE van por red; aquí solo se guardan los archivos de la app.
const VERSION = 'pedidos-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icono.svg'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // Páginas: primero la red (para recibir versiones nuevas); sin señal, la última copia.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone()
          caches.open(VERSION).then((c) => c.put('/', copia))
          return r
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    )
    return
  }
  // Archivos con nombre único (/assets/…): primero la copia guardada.
  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (guardado) =>
          guardado ||
          fetch(req).then((r) => {
            if (r.ok) {
              const copia = r.clone()
              caches.open(VERSION).then((c) => c.put(req, copia))
            }
            return r
          }),
      ),
    )
  }
})
