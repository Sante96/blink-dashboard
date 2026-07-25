import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { ChevronRight, GripVertical } from "lucide-react";
import { Text } from "@/components/ui/text";
import { CameraThumbnail } from "@/components/CameraThumbnail";
import type { Camera } from "@/lib/api";

const THUMB_REFRESH_MS = 30000; // aggiorna la miniatura ogni 30s

interface CameraDrawerProps {
  cameras: Camera[];
  isMock: (id: string) => boolean;
}

// Cassetto laterale a sinistra: chiuso mostra una linguetta, si apre on-hover
// mostrando le camere non in dashboard con la sola thumbnail (non live).
export function CameraDrawer({ cameras, isMock }: CameraDrawerProps) {
  const [open, setOpen] = useState(false);

  if (cameras.length === 0) return null;

  return (
    <div
      className="absolute left-0 top-0 z-40 flex h-full"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Linguetta sempre visibile, con contatore camere nascoste */}
      <div className="relative flex h-full w-6 items-center justify-center border-r border-white/10 bg-secondary/70 backdrop-blur-xl">
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
        {!open && (
          <span className="absolute right-0.5 top-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
            {cameras.length}
          </span>
        )}
      </div>

      {/* Pannello a cassetto */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="h-full w-56 overflow-y-auto border-r border-white/10 bg-secondary/80 p-3 shadow-2xl backdrop-blur-xl"
            initial={{ x: -16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -16, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <Text as="p" size="sm" weight="medium" className="mb-2 px-1 text-muted-foreground">
              Altre camere
            </Text>
            <div className="flex flex-col gap-2">
              {cameras.map((cam, i) => (
                <motion.div
                  key={cam.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 + i * 0.05 }}
                >
                  <DrawerCameraCard camera={cam} mock={isMock(cam.id)} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Card compatta nel cassetto: thumbnail 16:9 + nome, trascinabile.
function DrawerCameraCard({ camera, mock }: { camera: Camera; mock: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: camera.id,
    data: { name: camera.name },
  });

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className={`group/card relative cursor-grab overflow-hidden rounded-lg border border-white/10 bg-card/80 ring-primary/60 backdrop-blur-xl transition-[box-shadow] hover:border-primary/40 hover:shadow-lg hover:ring-1 active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="relative aspect-video w-full bg-black">
        <CameraThumbnail
          cameraName={camera.name}
          mock={mock}
          refreshMs={THUMB_REFRESH_MS}
          className="h-full w-full"
        />

        {/* Overlay "trascina" on-hover */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 backdrop-blur-[1px] transition-opacity duration-150 group-hover/card:opacity-100">
          <Text size="xs" weight="medium" shadow="md" className="flex items-center gap-1 text-white">
            <GripVertical className="h-3 w-3" />
            Trascina
          </Text>
        </div>

        <Text size="xs" weight="medium" className="absolute bottom-1 left-1 rounded-full border border-white/15 bg-black/50 px-1.5 py-0.5 text-white backdrop-blur-sm">
          {camera.name}
        </Text>
      </div>
    </motion.div>
  );
}
