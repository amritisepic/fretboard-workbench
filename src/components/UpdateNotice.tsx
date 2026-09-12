import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const OFFLINE_READY_MS = 5000;

/**
 * Registers the service worker. Says once when the app is ready to work offline, and offers a
 * reload when a new version has been downloaded. The working session is saved continuously, so
 * reloading keeps unsaved edits.
 */
export function UpdateNotice() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('The service worker could not be registered, so the app will not work offline.', error);
    },
  });

  useEffect(() => {
    if (offlineReady && !needRefresh) {
      const timer = setTimeout(() => setOfflineReady(false), OFFLINE_READY_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [offlineReady, needRefresh, setOfflineReady]);

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="update-notice" role="status" aria-live="polite">
      {needRefresh ? (
        <>
          <p>A new version of the workbench is ready.</p>
          <div className="update-actions">
            <button type="button" className="button is-compact" onClick={() => setNeedRefresh(false)}>
              Later
            </button>
            <button type="button" className="button is-compact is-primary" onClick={() => void updateServiceWorker(true)}>
              Reload
            </button>
          </div>
        </>
      ) : (
        <>
          <p>Ready to work offline.</p>
          <div className="update-actions">
            <button type="button" className="button is-compact" onClick={() => setOfflineReady(false)}>
              Dismiss
            </button>
          </div>
        </>
      )}
    </div>
  );
}
