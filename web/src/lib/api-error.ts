import { AxiosError } from "axios";

/**
 * Extracts a human-readable error message from an API error.
 * Handles the backend's `{ error: { kind, message } }` shape.
 */
export function parseApiError(err: unknown, fallback = "Something went wrong. Please try again."): string {
    if (err instanceof AxiosError && err.response?.data) {
        const d = err.response.data;
        const msg = d.error?.message || d.message;
        if (typeof msg === "string") return msg;
    }
    return fallback;
}
