import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT auth token & workspace id
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('nexaflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const savedWorkspace = localStorage.getItem('nexaflow_workspace');
    if (savedWorkspace) {
      try {
        const parsed = JSON.parse(savedWorkspace);
        if (parsed && (parsed.id || parsed._id)) {
          config.headers['x-workspace-id'] = parsed.id || parsed._id;
        }
      } catch (e) {
        // ignore parse error
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling 401 unauthorized & 403 stale workspace recovery
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // If token expired or invalid, clear and redirect to login
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          localStorage.removeItem('nexaflow_token');
          localStorage.removeItem('nexaflow_user');
          localStorage.removeItem('nexaflow_workspace');
          window.location.href = '/login';
        }
      } else if (error.response.status === 403) {
        // Clear possibly stale workspace from storage so backend can auto-resolve
        localStorage.removeItem('nexaflow_workspace');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
