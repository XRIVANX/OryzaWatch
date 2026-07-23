import axios from 'axios';

// Globally reusable axios module targeting your local Django server port
const API = axios.create({
    baseURL: 'http://127.0.0.1:8000/api/',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Interceptor to inject bearer tokens dynamically before hitting protected endpoints
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor to auto-refresh the access token when it expires (401 response)
API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If we get a 401 and haven't already retried this request
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');

            if (!refreshToken) {
                // No refresh token available — force logout
                localStorage.clear();
                window.location.href = '/';
                return Promise.reject(error);
            }

            try {
                const { data } = await axios.post(
                    'http://127.0.0.1:8000/api/auth/token/refresh/',
                    { refresh: refreshToken }
                );

                // Store the new access token
                localStorage.setItem('access_token', data.access);

                // If rotation is enabled, the server sends a new refresh token too
                if (data.refresh) {
                    localStorage.setItem('refresh_token', data.refresh);
                }

                // Retry the original failed request with the new access token
                originalRequest.headers.Authorization = `Bearer ${data.access}`;
                return API(originalRequest);
            } catch {
                // Refresh also failed (token expired or blacklisted) — force logout
                localStorage.clear();
                window.location.href = '/';
                return Promise.reject(error);
            }
        }

        return Promise.reject(error);
    }
);

export default API;