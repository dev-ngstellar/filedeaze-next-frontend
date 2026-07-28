import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getPortalPrefix, getCookie, setCookie, eraseCookie } from './auth-helper';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
console.log('API Base URL:', BASE_URL);

let accessToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;

// Sensible default for normal CRUD/report requests. Uploads get a much longer ceiling below —
// a single fixed timeout would either be too short for a multi-image upload or too long to ever
// catch a genuinely hung normal request.
const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const prefix = getPortalPrefix();
    const token = sessionStorage.getItem(`${prefix}_accessToken`) || getCookie(`${prefix}_accessToken`);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  // File/image uploads (multipart) legitimately take longer than a normal API call — give them
  // a generous ceiling instead of the default CRUD timeout, without every upload call site
  // needing to remember to set it itself.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.timeout = UPLOAD_TIMEOUT_MS;
  }
  return config;
});

function hardLogout() {
  if (typeof window !== 'undefined') {
    const prefix = getPortalPrefix();
    setAccessToken(null);
    sessionStorage.removeItem(`${prefix}_accessToken`);
    localStorage.removeItem(`${prefix}_refreshToken`);
    localStorage.removeItem(`${prefix}_user`);
    eraseCookie(`${prefix}_accessToken`);
    eraseCookie(`${prefix}_refreshToken`);
    
    const path = window.location.pathname;
    if (path !== '/login' && !path.endsWith('/login')) {
      window.location.href = '/login';
    }
  }
}

api.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original?._retry) {
      if (typeof window === 'undefined') return Promise.reject(error);
      // Login endpoints return 401 for wrong credentials — don't treat as session expiry
      const url = original?.url ?? '';
      if (url.includes('/login') || url.includes('/register') || url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }
      const prefix = getPortalPrefix();
      const rt = localStorage.getItem(`${prefix}_refreshToken`);
      if (!rt) { hardLogout(); return Promise.reject(error); }

      // Queue concurrent requests while a refresh is in flight
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (!token) { reject(error); return; }
            original.headers = original.headers ?? {};
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken: rt });
        const { accessToken: newAt, refreshToken: newRt } = data.data.tokens;
        setAccessToken(newAt);
        sessionStorage.setItem(`${prefix}_accessToken`, newAt);
        localStorage.setItem(`${prefix}_refreshToken`, newRt);
        setCookie(`${prefix}_accessToken`, newAt, 1);
        setCookie(`${prefix}_refreshToken`, newRt, 7);

        // Flush queue with new token
        refreshQueue.forEach(cb => cb(newAt));
        refreshQueue = [];

        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAt}`;
        return api(original);
      } catch {
        refreshQueue.forEach(cb => cb(null));
        refreshQueue = [];
        hardLogout();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 402 && typeof window !== 'undefined') {
      const prefix = getPortalPrefix();
      const stored = localStorage.getItem(`${prefix}_user`);
      let role: string | null = null;
      try { role = stored ? JSON.parse(stored).role : null; } catch { /* ignore */ }
      const subscriptionPath = role === 'MANAGER' ? '/manager/subscription' : '/admin/subscription';
      if (!window.location.pathname.endsWith('/subscription')) {
        window.location.href = subscriptionPath;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
