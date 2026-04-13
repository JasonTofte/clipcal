// Service worker for PWA share target — intercepts image shares from Android
// share sheet and routes them to the app.

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

function safeFilename(name) {
  if (!name || typeof name !== 'string') return 'shared.jpg';
  // Strip path separators, null bytes, control chars. Keep alnum, dash, underscore, dot.
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  return cleaned || 'shared.jpg';
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const mediaFile = formData.get('media');

    if (
      mediaFile &&
      mediaFile instanceof File &&
      ALLOWED_MIME.has(mediaFile.type) &&
      mediaFile.size > 0 &&
      mediaFile.size <= MAX_BYTES
    ) {
      const cache = await caches.open('clipcal-shared-media');
      await cache.put(
        '/shared-media/latest',
        new Response(mediaFile, {
          headers: {
            'Content-Type': mediaFile.type,
            'X-Filename': safeFilename(mediaFile.name),
          },
        }),
      );
    }
  } catch {
    // Share-target is best-effort; fall through to redirect
  }

  return Response.redirect('/?source=share', 303);
}
