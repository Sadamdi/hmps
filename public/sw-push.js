self.addEventListener('push', function (event) {
	let data = { title: 'Notifikasi Baru', body: '', icon: '/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp', url: '/' };
	try {
		const payload = event.data?.json();
		if (payload) {
			data.title = payload.title || data.title;
			data.body = payload.body || '';
			data.icon = payload.icon || data.icon;
			data.url = payload.url || '/';
		}
	} catch {}

	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			icon: data.icon,
			badge: data.icon,
			data: { url: data.url },
			vibrate: [100, 50, 100],
		})
	);
});

self.addEventListener('notificationclick', function (event) {
	event.notification.close();
	const url = event.notification.data?.url || '/';
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
			for (var i = 0; i < clientList.length; i++) {
				var client = clientList[i];
				if (client.url.includes(self.location.origin) && 'focus' in client) {
					client.navigate(url);
					return client.focus();
				}
			}
			if (clients.openWindow) {
				return clients.openWindow(url);
			}
		})
	);
});
