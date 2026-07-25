import { motion } from "framer-motion";

/**
 * Toggle switch glass con animazione spring.
 * Riutilizzabile ovunque nell'app.
 */
export function Switch({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 ${
        checked
          ? "border-primary/40 bg-primary/80 shadow-sm shadow-primary/20"
          : "border-white/15 bg-white/10"
      }`}
    >
      <motion.span
        className="block h-5 w-5 rounded-full bg-white shadow-md"
        animate={{ x: checked ? 22 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
