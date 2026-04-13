import { useEffect } from 'react';

/**
 * Picks up an image stashed by the PWA share-target service worker and
 * forwards it to the handler. The SW writes to the 'clipcal-shared-media'
 * cache and redirects here with ?source=share.
 */
export function useShareTarget(onFile: (file: File) => void): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'share') return;

    window.history.replaceState({}, '', '/');

    (async () => {
      try {
        const cache = await caches.open('clipcal-shared-media');
        const response = await cache.match('/shared-media/latest');
        if (!response) return;
        const blob = await response.blob();
        const rawName = response.headers.get('X-Filename') || 'shared.jpg';
        const safeName =
          rawName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'shared.jpg';
        const file = new File([blob], safeName, { type: blob.type });
        await cache.delete('/shared-media/latest');
        onFile(file);
      } catch {
        // best-effort
      }
    })();
  }, [onFile]);
}
