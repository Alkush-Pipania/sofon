import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { env } from "@/lib/env";

// ── Token helpers ───────────────────────────────────
const TOKEN_KEY = "sofon_token";

export const tokenStore = {
    get: (): string | null =>
        typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null,

    set: (token: string) =>
        typeof window !== "undefined" && localStorage.setItem(TOKEN_KEY, token),

    clear: () =>
        typeof window !== "undefined" && localStorage.removeItem(TOKEN_KEY),
};

// ── Axios instance ──────────────────────────────────
const api = axios.create({
    baseURL: env.API_URL,
    headers: { "Content-Type": "application/json" },
    timeout: 15_000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
    const token = tokenStore.get();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle 401 globally
api.interceptors.response.use(
    (res) => res,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            tokenStore.clear();
            if (typeof window !== "undefined") {
                window.location.href = "/signin";
            }
        }
        return Promise.reject(error);
    },
);

// ── Generic methods ─────────────────────────────────
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await api.get<T>(url, config);
    return res.data;
}

export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await api.post<T>(url, data, config);
    return res.data;
}

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await api.put<T>(url, data, config);
    return res.data;
}

export async function patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await api.patch<T>(url, data, config);
    return res.data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await api.delete<T>(url, config);
    return res.data;
}

export default api;
