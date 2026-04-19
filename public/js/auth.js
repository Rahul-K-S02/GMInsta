const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const messageBox = document.getElementById("message");

const showMessage = (msg, isError = false) => {
  if (!messageBox) return;
  messageBox.textContent = msg;
  messageBox.style.color = isError ? "#ef4444" : "#10b981";
};

const setFormLoading = (form, loading, label) => {
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.prevText = btn.textContent;
    btn.textContent = label || "Please wait...";
  } else if (btn.dataset.prevText) {
    btn.textContent = btn.dataset.prevText;
    delete btn.dataset.prevText;
  }
};

document.querySelectorAll(".pw-toggle[data-target]").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const id = toggle.getAttribute("data-target");
    const input = document.getElementById(id);
    if (!input) return;
    const nextType = input.type === "password" ? "text" : "password";
    input.type = nextType;
    toggle.textContent = nextType === "password" ? "Show" : "Hide";
  });
});

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      setFormLoading(loginForm, true, "Logging in...");
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
    } finally {
      setFormLoading(loginForm, false);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      setFormLoading(registerForm, true, "Creating...");
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
    } finally {
      setFormLoading(registerForm, false);
    }
  });
}
