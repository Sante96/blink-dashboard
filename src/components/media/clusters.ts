import type { MediaEvent } from "@/lib/api";

// Finestra (secondi) entro cui clip contigui vengono uniti in un'unica card,
// anche se provengono da telecamere diverse — come fa l'app mobile Blink.
export const CLUSTER_WINDOW_S = 60;

// Un cluster = uno o più clip correlati temporalmente.
export interface Cluster {
  key: string;
  time: number; // epoch ms del clip più recente
  events: MediaEvent[];
}

export function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

// Raggruppa gli eventi (già ordinati desc) in cluster temporali.
export function clusterEvents(events: MediaEvent[]): Cluster[] {
  const clusters: Cluster[] = [];
  for (const ev of events) {
    const t = toMs(ev.created_at);
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last.time - t) <= CLUSTER_WINDOW_S * 1000) {
      last.events.push(ev);
    } else {
      clusters.push({ key: `${ev.id}`, time: t, events: [ev] });
    }
  }
  return clusters;
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
