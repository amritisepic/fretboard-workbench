import { useWorkbench } from '../state/workbench';
import { BoxCard } from './BoxCard';

export function Workspace() {
  const boxes = useWorkbench((s) => s.boxes);
  const selectedBoxId = useWorkbench((s) => s.selectedBoxId);
  const addBox = useWorkbench((s) => s.addBox);

  return (
    <main className="workspace">
      {boxes.length === 0 ? (
        <div className="empty-state">
          <button type="button" className="add-button" aria-label="Add a box" onClick={() => addBox()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="boxes">
          {boxes.map((box) => (
            <BoxCard key={box.id} box={box} selected={box.id === selectedBoxId} />
          ))}
        </div>
      )}
    </main>
  );
}
