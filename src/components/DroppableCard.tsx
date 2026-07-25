import { AnimatePresence, motion } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import { Text } from "@/components/ui/text";
import { ArrowLeftRight } from "lucide-react";

// Wrapper che rende una card della dashboard bersaglio del drop dal cassetto.
export function DroppableCard({
  id,
  isDragging,
  children,
}: {
  id: string;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <motion.div
      ref={setNodeRef}
      layout
      transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
      className={`relative h-full w-full rounded-lg transition-[box-shadow] ${
        isOver ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
    >
      {children}

      {/* Overlay "rilascia qui" mentre si trascina */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-lg border-2 border-dashed ${
              isOver
                ? "border-primary bg-primary/20"
                : "border-white/25 bg-black/40"
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Text
              size="sm"
              weight="medium"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur-md ${
                isOver
                  ? "border-primary/40 bg-primary/30 text-primary-foreground"
                  : "border-white/15 bg-white/10 text-white/90"
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {isOver ? "Rilascia per sostituire" : "Rilascia qui"}
            </Text>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
