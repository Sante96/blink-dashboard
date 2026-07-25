import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Pill con effetto glassmorphism (sfondo sfocato semitrasparente).
 * Usata per i controlli on-hover sulle camere e per il toggle in navbar.
 */
const GlassPill = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-full border border-white/15",
      "bg-white/10 px-1 py-1 shadow-lg backdrop-blur-xl",
      className
    )}
    {...props}
  />
));
GlassPill.displayName = "GlassPill";

/** Bottone interno a una GlassPill (icona o testo), con feedback tattile. */
const GlassPillButton = React.forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button"> & { active?: boolean }
>(({ className, active, ...props }, ref) => (
  <motion.button
    ref={ref}
    whileTap={{ scale: 0.92 }}
    transition={{ duration: 0.12 }}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5",
      "text-shadow-sm text-xs font-medium text-white/90 transition-colors",
      "hover:bg-white/15 active:bg-white/20 disabled:opacity-50 disabled:pointer-events-none",
      active && "bg-primary/30 text-primary-foreground hover:bg-primary/40",
      className
    )}
    {...props}
  />
));
GlassPillButton.displayName = "GlassPillButton";

export { GlassPill, GlassPillButton };
