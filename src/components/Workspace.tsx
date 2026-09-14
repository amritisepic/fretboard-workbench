import { useWorkbench } from '../state/workbench';
import { Canvas } from './Canvas';

export function Workspace({ onRequestRemove }: { readonly onRequestRemove: (boxId: string) => void }) {
  const hasBoxes = useWorkbench((s) => s.boxes.length > 0);
  const viewing = useWorkbench((s) => s.viewing);
  const addBox = useWorkbench((s) => s.addBox);

  return (
    <main className={viewing ? 'workspace is-viewing' : 'workspace'}>
      {hasBoxes ? (
        <Canvas onRequestRemove={onRequestRemove} />
      ) : viewing ? (
        <div className="empty-state">
          <p className="empty-note">Nothing to show yet. Switch to Edit to add a chord.</p>
        </div>
      ) : (
        <div className="empty-state">
          <button type="button" className="add-button" aria-label="Add a box" onClick={() => addBox()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      )}
    </main>
  );
}
