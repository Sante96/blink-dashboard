import { save } from "@tauri-apps/api/dialog";
import { invoke } from "@tauri-apps/api/tauri";

// Scarica un asset (clip .mp4) su disco: il frontend fa il fetch tramite il
// proxy autenticato del backend, poi passa i byte a un comando Rust che apre il
// dialog "salva con nome" e scrive il file. Fuori da Tauri fa un fallback al
// download del browser.

export async function downloadFile(url: string, suggestedName: string): Promise<boolean> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fallito (${res.status})`);
  const blob = await res.blob();

  // Fuori da Tauri (dev browser): usa il download nativo del browser.
  if (!("__TAURI__" in window)) {
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(objUrl);
    return true;
  }

  const path = await save({
    defaultPath: suggestedName,
    filters: [{ name: "Video", extensions: ["mp4"] }],
  });
  if (!path) return false; // annullato dall'utente

  // Base64 invece di Vec<u8>: l'IPC serializza gli array di byte come JSON di
  // numeri (~5x la dimensione del file), il base64 costa solo ~1.33x.
  const bytesB64 = await blobToBase64(blob);
  await invoke("save_bytes", { path, bytesB64 });
  return true;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // reader.result è un data URL ("data:...;base64,XXXX"): teniamo solo il payload.
    reader.onload = () => resolve((reader.result as string).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
