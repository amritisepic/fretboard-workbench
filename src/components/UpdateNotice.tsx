import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registers the service worker and offers a reload once a new version has been downloaded. The
 * working session is saved continuously, so reloading keeps unsaved edits.
 *
 * Nothing is said when the worker finishes caching the app for the first time. That happens on a
 * first visit and only ever then, landing over the welcome card and the first fretboard, and it
 * asks nothing of the reader: the app is offline-capable whether or not they are told so, and they
 * find that out the first time they open it without a network. A waiting new version is the
 * opposite: a choice only the user can make, on a visit where they already know the app.
 */
export function UpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('The service worker could not be registered, so the app will not work offline.', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="update-notice" role="status" aria-live="polite">
      <p>A new version of the workbench is ready.</p>
      <div className="update-actions">
        <button type="button" className="button is-compact" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <button type="button" className="button is-compact is-primary" onClick={() => void updateServiceWorker(true)}>
          Reload
        </button>
      </div>
    </div>
  );
}
