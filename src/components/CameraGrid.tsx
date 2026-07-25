import { useEffect, useRef, useState, type ReactNode } from "react";

const ASPECT = 16 / 9;
const GAP = 16; // px, coerente con gap-4

/**
 * Griglia che dispone le card 16:9 in modo da riempire lo spazio disponibile
 * SENZA mai generare scrollbar. Calcola il numero di colonne ottimale e la
 * dimensione delle celle in base al container, scegliendo il layout che
 * massimizza l'area delle card mantenendo l'aspect ratio.
 */
export function CameraGrid({ count, children }: { count: number; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ cols: 1, cellW: 0, cellH: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function recompute() {
      if (!el) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      if (W === 0 || H === 0 || count === 0) return;

      let best = { cols: 1, cellW: 0, cellH: 0, area: 0 };

      // Prova ogni possibile numero di colonne (1..count) e tieni quello che
      // dà le card più grandi rispettando l'aspect ratio.
      for (let cols = 1; cols <= count; cols++) {
        const rows = Math.ceil(count / cols);
        const availW = (W - GAP * (cols - 1)) / cols;
        const availH = (H - GAP * (rows - 1)) / rows;
        // La cella deve stare in availW x availH mantenendo 16:9
        let cellW = availW;
        let cellH = cellW / ASPECT;
        if (cellH > availH) {
          cellH = availH;
          cellW = cellH * ASPECT;
        }
        const area = cellW * cellH;
        if (area > best.area) {
          best = { cols, cellW, cellH, area };
        }
      }

      setLayout({ cols: best.cols, cellW: best.cellW, cellH: best.cellH });
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center">
      <div
        className="grid content-center justify-center"
        style={{
          gridTemplateColumns: `repeat(${layout.cols}, ${layout.cellW}px)`,
          gridAutoRows: `${layout.cellH}px`,
          gap: `${GAP}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
