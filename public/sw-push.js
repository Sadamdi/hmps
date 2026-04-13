var DEFAULT_ICON = '/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp';

self.addEventListener('push', function (event) {
	var data = { title: 'Notifikasi Baru', body: '', icon: DEFAULT_ICON, image: '', url: '/', tag: '' };
	try {
		var payload = event.data && event.data.json();
		if (payload) {
			data.title = payload.title || data.title;
			data.body = payload.body || '';
			data.icon = payload.icon || DEFAULT_ICON;
			data.image = payload.image || '';
			data.url = payload.url || '/';
			data.tag = payload.tag || '';
		}
	} catch (e) {}

	var opts = {
		body: data.body,
		icon: data.icon,
		badge: DEFAULT_ICON,
		data: { url: data.url },
		vibrate: [100, 50, 100],
	};

	if (data.image) {
		opts.image = data.image;
	}

	if (data.tag) {
		opts.tag = data.tag;
	}

	event.waitUntil(
		self.registration.showNotification(data.title, opts)
	);
});

self.addEventListener('notificationclick', function (event) {
	event.notification.close();
	var url = (event.notification.data && event.notification.data.url) || '/';
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
			for (var i = 0; i < clientList.length; i++) {
				var client = clientList[i];
				if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
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
