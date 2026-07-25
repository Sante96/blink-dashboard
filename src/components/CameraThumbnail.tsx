import { useState, useEffect, useRef } from "react";
import { API_BASE } from "@/lib/api";
import { Camera as CameraIcon } from "lucide-react";

interface CameraThumbnailProps {
  cameraName: string;
  /** Camera fittizia: mostra solo il placeholder. */
  mock?: boolean;
  /** Intervallo di refresh in ms. 0 = singolo caricamento, nessun polling. */
  refreshMs?: number;
  className?: string;
}

/**
 * Thumbnail di una camera: carica l'immagine dal backend, revoca il blob URL
 * al cambio e fa polling opzionale per aggiornare periodicamente.
 * Usato sia da DevicesPage che da CameraDrawer.
 */
export function CameraThumbnail({
  cameraName,
  mock = false,
  refreshMs = 0,
  className = "",
}: CameraThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (mock) return;
    let cancelled = false;

    async function loadThumb() {
      try {
        const res = await fetch(
          `${API_BASE}/cameras/${encodeURIComponent(cameraName)}/thumbnail?ts=${Date.now()}`
        );
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        setSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } catch {
        // rete giù: riprova al prossimo tick (se refreshMs > 0)
      }
    }

    loadThumb();
    if (refreshMs > 0) {
      timerRef.current = window.setInterval(loadThumb, refreshMs);
    }
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      setSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [cameraName, mock, refreshMs]);

  if (src) {
    return (
      <img
        src={src}
        alt={cameraName}
        className={`object-cover ${className}`}
        draggable={false}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-secondary/80 to-background ${className}`}>
      <CameraIcon className="h-1/3 w-1/3 text-muted-foreground/40" />
    </div>
  );
}
