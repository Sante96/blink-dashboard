import { currentVersion } from "@/lib/changelog";

const SEEN_VERSION_KEY = "blink_seen_version";

// Rileva se l'app è stata aggiornata dall'ultimo avvio confrontando la versione
// corrente con quella salvata. Alla prima esecuzione (nessuna versione salvata)
// non notifica nulla: registra soltanto la versione attuale.
//
// Quando l'autoupdate Tauri sarà attivo, l'updater riavvierà l'app sulla nuova
// versione: questo confronto scatterà da solo e mostrerà la notifica. Nel
// frattempo funziona già a ogni bump manuale della versione.
export function checkForUpdateNotice(): { updatedTo: string } | null {
  let seen: string | null = null;
  try {
    seen = localStorage.getItem(SEEN_VERSION_KEY);
  } catch {}

  // Aggiorna sempre la versione vista.
  try {
    localStorage.setItem(SEEN_VERSION_KEY, currentVersion);
  } catch {}

  // Prima installazione o nessun cambiamento: nessuna notifica.
  if (!seen || seen === currentVersion) return null;

  return { updatedTo: currentVersion };
}
