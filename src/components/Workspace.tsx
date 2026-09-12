import { useWorkbench } from '../state/workbench';
import { Canvas } from './Canvas';

export function Workspace() {
  const hasBoxes = useWorkbench((s) => s.boxes.length > 0);
  const addBox = useWorkbench((s) => s.addBox);

  return (
    <main className="workspace">
      {hasBoxes ? (
        <Canvas />
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
