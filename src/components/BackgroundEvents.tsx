/**
 * Componente wrapper per useBackgroundEvents.
 *
 * Montato sempre dentro NotificationsProvider in App.tsx, così il WebSocket
 * resta attivo anche quando la finestra è nascosta nella tray.
 * Non renderizza nulla: è solo un contenitore per l'hook.
 */

import { useBackgroundEvents } from "@/lib/useBackgroundEvents";

interface BackgroundEventsProps {
  /** Connette il WebSocket solo quando l'utente è loggato. */
  enabled: boolean;
}

export function BackgroundEvents({ enabled }: BackgroundEventsProps) {
  useBackgroundEvents(enabled);
  return null;
}
