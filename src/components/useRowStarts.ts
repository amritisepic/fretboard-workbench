import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** For each `.box-group` child of the container, whether the flex layout wrapped onto a new row before it. */
export function useRowStarts(containerRef: RefObject<HTMLElement | null>): readonly boolean[] {
  const [starts, setStarts] = useState<readonly boolean[]>([]);
  const measure = useRef(() => {});

  measure.current = () => {
    const container = containerRef.current;
    if (!container) return;
    const groups = Array.from(container.querySelectorAll<HTMLElement>(':scope > .box-group'));
    const next = groups.map((group, i) => i === 0 || group.offsetTop > groups[i - 1].offsetTop + 1);
    setStarts((previous) =>
      previous.length === next.length && previous.every((value, i) => value === next[i]) ? previous : next,
    );
  };

  // Box widths depend on fret count, strips and content, so measure after every render.
  useLayoutEffect(() => {
    measure.current();
  });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure.current());
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return starts;
}
