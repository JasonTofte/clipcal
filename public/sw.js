// Service worker for PWA share target — intercepts image shares from Android
// share sheet and routes them to the app.

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request) {
  const formData = await request.formData();
  const mediaFile = formData.get('media');

  if (mediaFile && mediaFile instanceof File) {
    // Store the shared image in a temporary cache for the app to pick up
    const cache = await caches.open('clipcal-shared-media');
    await cache.put(
      '/shared-media/latest',
      new Response(mediaFile, {
        headers: {
          'Content-Type': mediaFile.type,
          'X-Filename': mediaFile.name,
        },
      }),
    );
  }

  // Redirect to the main page with a query param so the app knows to
  // check the cache for a shared image.
  return Response.redirect('/?source=share', 303);
}
