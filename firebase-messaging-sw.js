// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Deve ser idêntico ao config do atendente.js para evitar erros de avaliação
firebase.initializeApp({
  apiKey: "AIzaSyAftUTevxn9QT7TwUAyWRVRvXCBR5-6QKU",
  authDomain: "alerta-cardapio-automovel.firebaseapp.com",
  projectId: "alerta-cardapio-automovel",
  storageBucket: "alerta-cardapio-automovel.firebasestorage.app",
  messagingSenderId: "74575424285",
  appId: "1:74575424285:web:c16d1c8433480761cf4ff4",
  measurementId: "G-4YTG9TPF1D"
});

const messaging = firebase.messaging();

// Captura notificações em segundo plano (background)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificação recebida em background: ', payload);
  
  const notificationTitle = payload.notification?.title || "Novo Pedido!";
  const notificationOptions = {
    body: payload.notification?.body || "Você tem um novo pedido no painel.",
    icon: '/logo_automovel.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/atendente.html'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Abre o painel ao clicar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('/atendente.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/atendente.html');
      }
    })
  );
});
