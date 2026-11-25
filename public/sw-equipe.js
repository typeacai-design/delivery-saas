/* WeDelivery · área da equipe: recebe notificações (Cozinha, Garçom, Motoboy) mesmo com o site em segundo plano. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let aviso = { titulo: 'WeDelivery', corpo: 'Você tem uma novidade', url: '/acesso', tag: undefined }
  try { aviso = { ...aviso, ...event.data.json() } } catch (e) { /* aviso padrão */ }
  event.waitUntil(Promise.all([
    self.registration.showNotification(aviso.titulo, {
      body: aviso.corpo, tag: aviso.tag, renotify: Boolean(aviso.tag), requireInteraction: true,
      icon: '/apple-icon', badge: '/apple-icon', vibrate: [300, 120, 300, 120, 300], data: { url: aviso.url },
    }),
    // Avisa a tela aberta para atualizar a lista na hora.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => lista.forEach(c => c.postMessage({ tipo: 'wd-push', url: aviso.url }))),
  ]))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const destino = new URL((event.notification.data && event.notification.data.url) || '/acesso', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const aberta = lista.find(c => c.url.startsWith(self.location.origin + '/acesso'))
    if (aberta) { aberta.navigate(destino).catch(() => {}); return aberta.focus() }
    return self.clients.openWindow(destino)
  }))
})
