/**
 * Service Worker for Web Push
 */
self.addEventListener("push", function(event) {
  if (event.data) {
    const payload = event.data.json();
    
    const origin = self.location.origin;
    const options = {
      body: payload.body,
      icon: `${origin}/logo.svg`,
      badge: `${origin}/logo.svg`,
      image: payload.image,
      vibrate: [200, 100, 200],
      data: payload.data,
      requireInteraction: false,
      tag: payload.data.url || "synap-default",
      renotify: true,
      actions: payload.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(payload.title, options)
    );
  }
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  // If a specific action button was clicked, handle it here
  // (We map action ID to URL in publisher if they match, or we could pass a map in data)
  // Current publisher maps action: "link" or "open".
  
  let targetUrl = event.notification.data.url || "/";
  
  if (event.action && event.action !== "open" && event.action !== "") {
     // If the action holds a URL (simple convention used in publisher)
     targetUrl = event.action;
  }

  // Handle click: focus existing tab or open new one
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
