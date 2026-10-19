import { isNativeApp } from './nativeLocation';

// Default hosted Cloud Run server for this AI Studio project
export const DEFAULT_CLOUD_SERVER_URL =
  'https://ais-dev-64zkshl45xh2tm6desmgrb-509508212277.us-west1.run.app';

/**
 * Get current configured API base URL.
 * When running in a native Android/iOS APK (Capacitor) or localhost webview,
 * relative paths like /api/... fail because there is no server on localhost inside the phone.
 * We resolve to the configured server URL, or fallback to the AI Studio cloud backend.
 */
export function getServerUrl(): string {
  // 1. User manual override from Settings / Connection Hub
  const saved = localStorage.getItem('kintrack_server_url');
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  // 2. Build-time environment variable (if specified)
  const envUrl = (import.meta as any).env?.VITE_SERVER_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. Native Capacitor APK or Android WebView running from localhost/file/capacitor scheme
  if (
    isNativeApp() ||
    (typeof window !== 'undefined' &&
      (window.location.origin.includes('localhost') ||
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'file:'))
  ) {
    return DEFAULT_CLOUD_SERVER_URL;
  }

  // 4. In standard web browser session hosted on server, relative paths work directly
  return '';
}

/**
 * Update the server URL in localStorage
 */
export function setServerUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) {
    localStorage.removeItem('kintrack_server_url');
  } else {
    localStorage.setItem('kintrack_server_url', clean);
  }
  window.dispatchEvent(new CustomEvent('kintrack_server_url_changed', { detail: clean }));
}

/**
 * Resolve an API path with the appropriate host prefix
 */
export function apiUrl(path: string): string {
  const base = getServerUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Centralized fetch helper with server host resolution and auto-fallback
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(input);
  return fetch(url, init);
}

/**
 * Test connectivity to a specific server URL or the current active server URL
 */
export async function testServerConnection(targetUrl?: string): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
  serverUrl: string;
}> {
  const base = (targetUrl !== undefined ? targetUrl.trim().replace(/\/+$/, '') : getServerUrl()) || window.location.origin;
  const start = Date.now();
  const testUrl = `${base}/api/circle/ORBIT-FAMILY?_t=${Date.now()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return { ok: true, latencyMs, serverUrl: base };
    } else {
      return { ok: false, latencyMs, error: `HTTP ${res.status}: ${res.statusText}`, serverUrl: base };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;
    const msg = err.name === 'AbortError' ? 'Connection timed out (4s)' : err.message || 'Network error';
    return { ok: false, latencyMs, error: msg, serverUrl: base };
  }
}
