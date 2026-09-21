import { useWorkbench } from '../state/workbench';
import { Canvas } from './Canvas';

export function Workspace({
  onRequestRemove,
  onOpenExamples,
}: {
  readonly onRequestRemove: (boxId: string) => void;
  readonly onOpenExamples: () => void;
}) {
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
        // The first thing anyone sees, so it says what a workbench is made of and offers both ways
        // in: an empty box to fill, or a finished progression to look at.
        <div className="empty-state">
          <div className="empty-card">
            <h2 className="empty-title">Nothing on the workbench yet</h2>
            <p className="empty-body">
              Every chord gets a box with its own neck. Add one and click notes to build a chord, or open one of the
              built-in progressions to see a finished one.
            </p>
            <div className="empty-actions">
              <button type="button" className="button is-primary" onClick={() => addBox()}>
                Add a box
              </button>
              <button type="button" className="button" onClick={onOpenExamples}>
                Open an example
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
