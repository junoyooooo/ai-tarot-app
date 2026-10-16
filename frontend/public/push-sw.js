// 웹 푸시 수신 처리(서비스 워커에 합쳐져요). 개인정보는 담지 않고 제목·본문·열 주소만 받아요.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || '토닥토닥 별빛타로';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '오늘의 카드가 도착했어요.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
