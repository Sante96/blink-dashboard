import { Dithering } from "@paper-design/shaders-react";
import { useSettings } from "@/lib/settings";

/**
 * Background animato con dithering shader.
 * Reagisce in tempo reale alle impostazioni salvate.
 */
export function ShaderBackground() {
  const { shaderOpacity, shaderSpeed, shaderShape } = useSettings();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: shaderOpacity / 100 }}
    >
      <Dithering
        colorBack="#0a0a0a"
        colorFront="#56ae6c"
        shape={shaderShape as "simplex" | "warp" | "dots" | "wave" | "ripple" | "swirl" | "sphere"}
        type="random"
        size={2.6}
        speed={shaderSpeed}
        scale={0.92}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
