import axios from "axios";


const API_URL = "http://localhost:3000/api/v1";

export const client = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request interceptor to add auth token
client.interceptors.request.use(
    (config) => {
        // Read directly from localStorage to ensure we have the latest token
        // matching the logic in state/auth.ts
        const stored = window.localStorage.getItem("synapstore:auth");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed?.token) {
                    config.headers.Authorization = `Bearer ${parsed.token}`;
                }
            } catch (e) {
                // ignore
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for global error handling
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            // We could dispatch a custom event or clear storage
            // For now, let the UI handle the 401 or AuthContext will catch it on reload
            // window.location.href = "/login"; // drastic, maybe just let it fail
        }
        return Promise.reject(error);
    }
);
