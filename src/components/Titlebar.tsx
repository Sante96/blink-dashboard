import { appWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { BlinkLogo } from "@/components/BlinkLogo";

/**
 * Titlebar custom — logo a sinistra, controlli finestra in pill a destra.
 * Usa data-tauri-drag-region per il drag della finestra.
 */
export function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="flex h-8 shrink-0 items-center justify-between px-3"
    >
      {/* Logo */}
      <BlinkLogo className="pointer-events-none h-3.5 w-auto text-primary" />

      {/* Controlli finestra in pill */}
      <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5 backdrop-blur-xl">
        <button
          onClick={() => appWindow.minimize()}
          className="flex h-5 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
        >
          <Minus className="h-3 w-3" />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="flex h-5 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/15 hover:text-foreground"
        >
          <Square className="h-2.5 w-2.5" />
        </button>
        <button
          onClick={() => appWindow.close()}
          className="flex h-5 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/70 hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
