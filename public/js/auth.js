const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const messageBox = document.getElementById("message");

const showMessage = (msg, isError = false) => {
  if (!messageBox) return;
  messageBox.textContent = msg;
  messageBox.style.color = isError ? "#ef4444" : "#10b981";
};

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const data = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      setAuth(data);
      window.location.href = "/home";
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const data = await apiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      });
      setAuth(data);
      window.location.href = "/home";
    } catch (error) {
      showMessage(error.message, true);
    }
  });
}
