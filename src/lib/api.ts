// Base URL del backend locale: unica fonte di verità, importarla ovunque
// serva invece di duplicare l'indirizzo.
export const API_BASE = "http://127.0.0.1:8000";
export const WS_BASE = API_BASE.replace(/^http/, "ws");

// Token anti-CSRF condiviso con il backend. Dentro Tauri lo leggiamo via IPC;
// in dev (browser puro) è vuoto e il middleware backend lo bypassa.
let _localToken: string | null = null;

async function loadLocalToken(): Promise<string> {
  if (_localToken !== null) return _localToken;
  if ("__TAURI__" in window) {
    const { invoke } = await import("@tauri-apps/api/tauri");
    _localToken = await invoke<string>("get_local_token");
  } else {
    _localToken = "";
  }
  return _localToken;
}

export interface CameraCapabilities {
  light: boolean;
}

export interface Camera {
  name: string;
  id: string;
  product_type?: string;
  armed: boolean;
  motion_detected: boolean;
  temperature: number | null;
  battery: string | null;
  wifi_strength: number | null;
  thumbnail: string;
  last_motion: string | null;
  serial?: string | null;
  firmware?: string | null;
  capabilities?: CameraCapabilities;
}

export interface CameraSetting {
  key: string;
  label: string;
  type: "text" | "toggle" | "select" | "slider";
  value: string | number | boolean;
  group: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export interface CameraSettings {
  name: string;
  product_type: string | null;
  settings: CameraSetting[];
}

export interface SyncModule {
  name: string;
  id: string;
  armed: boolean;
  cameras: string[];
}

export interface MediaEvent {
  id: number;
  created_at: string;
  device_name: string;
  device_id: number | null;
  network_id: number | null;
  network_name: string | null;
  type: string | null;
  source: string | null;
  deleted: boolean;
  watched: boolean;
  media: string;
  thumbnail: string;
  additional_devices: unknown[];
}

export interface StatusResponse {
  connected: boolean;
  requires_pin: boolean;
  email: string | null;
}

export interface LoginResponse {
  success: boolean;
  requires_pin: boolean;
}

// --- Errori tipizzati ---

export class NetworkError extends Error {
  constructor(message = "Network error") {
    super(message);
    this.name = "NetworkError";
  }
}

export class SessionExpiredError extends Error {
  constructor(message = "Session expired") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await loadLocalToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { "X-Blink-Token": token } : {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string>) },
    });
  } catch {
    throw new NetworkError();
  }

  if (res.status === 401) {
    throw new SessionExpiredError();
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Errore sconosciuto" }));
    throw new ApiError(res.status, error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

/** Token da appendere alle connessioni WebSocket come query param. */
export async function getLocalToken(): Promise<string> {
  return loadLocalToken();
}

export const api = {
  // Health check leggero (solo verifica che il backend risponda)
  healthCheck: async (): Promise<boolean> => {
    try {
      const token = await loadLocalToken();
      const headers: Record<string, string> = token ? { "X-Blink-Token": token } : {};
      const res = await fetch(`${API_BASE}/status`, { headers });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Status
  getStatus: () => request<StatusResponse>("/status"),

  // Auth
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  verifyPin: (pin: string) =>
    request<{ success: boolean }>("/auth/verify-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),

  logout: () =>
    request<{ success: boolean }>("/auth/logout", { method: "POST" }),

  // Cameras
  getCameras: () => request<{ cameras: Camera[] }>("/cameras"),

  snapCamera: (cameraName: string) =>
    request<{ success: boolean; thumbnail: string }>(
      `/cameras/${encodeURIComponent(cameraName)}/snap`,
      { method: "POST" }
    ),

  armCamera: (cameraName: string) =>
    request<{ success: boolean; armed: boolean }>(
      `/cameras/${encodeURIComponent(cameraName)}/arm`,
      { method: "POST" }
    ),

  disarmCamera: (cameraName: string) =>
    request<{ success: boolean; armed: boolean }>(
      `/cameras/${encodeURIComponent(cameraName)}/disarm`,
      { method: "POST" }
    ),

  getLight: (cameraName: string) =>
    request<{ light: boolean | null }>(
      `/cameras/${encodeURIComponent(cameraName)}/light`
    ),

  lightOn: (cameraName: string) =>
    request<{ success: boolean; light: boolean }>(
      `/cameras/${encodeURIComponent(cameraName)}/light/on`,
      { method: "POST" }
    ),

  lightOff: (cameraName: string) =>
    request<{ success: boolean; light: boolean }>(
      `/cameras/${encodeURIComponent(cameraName)}/light/off`,
      { method: "POST" }
    ),

  // System (tutte le camere)
  armSystem: () =>
    request<{ success: boolean; armed: boolean }>("/system/arm", {
      method: "POST",
    }),

  disarmSystem: () =>
    request<{ success: boolean; armed: boolean }>("/system/disarm", {
      method: "POST",
    }),

  // Impostazioni camera
  getSettings: (cameraName: string) =>
    request<CameraSettings>(
      `/cameras/${encodeURIComponent(cameraName)}/settings`
    ),

  updateSettings: (cameraName: string, changes: Record<string, unknown>) =>
    request<{ success: boolean }>(
      `/cameras/${encodeURIComponent(cameraName)}/settings`,
      { method: "PATCH", body: JSON.stringify({ changes }) }
    ),

  // Sync modules
  getSyncModules: () => request<{ sync_modules: SyncModule[] }>("/sync"),

  // Media cloud (eventi di movimento)
  getEvents: (page = 1, pages = 3) =>
    request<{ events: MediaEvent[]; page: number; pages: number }>(
      `/media?page=${page}&pages=${pages}`
    ),

  deleteEvents: (ids: number[]) =>
    request<{ success: boolean; deleted: number[] }>("/media/delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  // Unisce più clip in un unico video a griglia (multi-camera). Ritorna un
  // object URL da usare in <video>; ricordarsi di revocarlo con URL.revokeObjectURL.
  mergeEvents: async (paths: string[]): Promise<string> => {
    const token = await loadLocalToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { "X-Blink-Token": token } : {}),
    };
    const res = await fetch(`${API_BASE}/media/merge`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(err || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  // URL diretti agli asset proxati (usati in <img>/<video> e per il download)
  eventVideoUrl: (path: string) =>
    `${API_BASE}/media/video?path=${encodeURIComponent(path)}`,

  eventThumbnailUrl: (path: string) =>
    `${API_BASE}/media/thumbnail?path=${encodeURIComponent(path)}`,
};
