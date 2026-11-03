export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3101/api/v1';
export const TOKEN_KEY = 'cauce_token';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const getToken = () => (typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY));
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

function qs(params?: Record<string, string | number | boolean | null | undefined>) {
  if (!params) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function raw(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.', 0);
  }
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    clearToken();
    if (typeof window !== 'undefined' && !location.pathname.startsWith('/login')) location.href = '/login';
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const j = await res.json();
      msg = Array.isArray(j.message) ? j.message.join(' · ') : (j.message ?? msg);
    } catch {
      /* sin cuerpo */
    }
    throw new ApiError(msg, res.status);
  }
  return res;
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; params?: Record<string, string | number | boolean | null | undefined> } = {},
): Promise<T> {
  const res = await raw(path + qs(opts.params), {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append('archivo', file);
  const res = await raw(path, { method: 'POST', body: fd });
  return (await res.json()) as T;
}

export async function apiBlob(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const res = await raw(path + qs(params));
  return res.blob();
}

export async function descargar(path: string, params: Record<string, string | undefined>, nombre: string) {
  const blob = await apiBlob(path, params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
