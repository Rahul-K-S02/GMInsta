const API_BASE = "/api";

const getToken = () => localStorage.getItem("token");
const getMe = () => JSON.parse(localStorage.getItem("user") || "null");
const setAuth = (data) => {
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
};
const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
const requireAuth = () => {
  if (!getToken()) window.location.href = "/";
};

async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  if (!headers.Authorization && getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  const raw = await res.text();
  let data = {};

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      data = { message: raw };
    }
  }

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}
