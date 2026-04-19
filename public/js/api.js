const API_BASE = "/api";

const getToken = () => localStorage.getItem("token");
const getMe = () => JSON.parse(localStorage.getItem("user") || "null");

const getAvatarLetter = (user) => {
  const raw = (user?.username || user?.email || "").trim();
  return raw ? raw.charAt(0).toUpperCase() : "G";
};

const refreshHeaderAvatar = () => {
  const letter = getAvatarLetter(getMe());
  document.querySelectorAll(".header-avatar").forEach((node) => {
    node.textContent = letter;
  });
};

// Used by pages that update profile data in localStorage.
window.refreshHeaderAvatar = refreshHeaderAvatar;
document.addEventListener("DOMContentLoaded", refreshHeaderAvatar);

const setAuth = (data) => {
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  refreshHeaderAvatar();
};
const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  refreshHeaderAvatar();
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
