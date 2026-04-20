const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const messageBox = document.getElementById("message");
const googleButton = document.getElementById("googleAuthButton");
const googleReauthHint = document.getElementById("googleReauthHint");
const authUrlParams = new URLSearchParams(window.location.search);

const sanitizeReturnTo = (value) => (typeof value === "string" && value.startsWith("/") ? value : "/home");
const returnTo = sanitizeReturnTo(authUrlParams.get("returnTo"));

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

const clearGoogleReauthPrompt = () => {
  if (googleReauthHint) {
    googleReauthHint.hidden = true;
    googleReauthHint.textContent = "Use Google to sign in to this account.";
  }
  googleButton?.classList.remove("reauth-highlight");
};

const showGoogleReauthPrompt = (message) => {
  if (googleReauthHint) {
    googleReauthHint.textContent = message || "Use Google to sign in to this account.";
    googleReauthHint.hidden = false;
  }
  googleButton?.classList.add("reauth-highlight");
  googleButton?.scrollIntoView({ behavior: "smooth", block: "center" });
};

const buildGoogleStartUrl = () => {
  const params = new URLSearchParams();
  params.set("mode", registerForm ? "register" : "login");
  params.set("returnTo", returnTo);

  if (registerForm) {
    const usernameInput = document.getElementById("username");
    const preferredUsername = usernameInput?.value.trim();
    if (preferredUsername) params.set("preferredUsername", preferredUsername);
  }

  return `/api/auth/google/start?${params.toString()}`;
};

const updateGoogleButton = () => {
  if (!googleButton) return;
  googleButton.textContent = registerForm ? "Continue with Google" : "Sign in with Google";
};

if (googleButton) {
  googleButton.addEventListener("click", () => {
    clearGoogleReauthPrompt();
    window.location.href = buildGoogleStartUrl();
  });
}

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
      clearGoogleReauthPrompt();
      setFormLoading(loginForm, true, "Logging in...");
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const data = await apiFetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      setAuth(data);
      window.location.href = returnTo;
    } catch (error) {
      showMessage(error.message, true);
      if (error.message.includes("Google sign-in")) {
        showGoogleReauthPrompt(error.message);
      }
    } finally {
      setFormLoading(loginForm, false);
    }
  });
}

if (registerForm) {
  const usernameInput = document.getElementById("username");
  usernameInput?.addEventListener("input", updateGoogleButton);

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
      window.location.href = returnTo;
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      setFormLoading(registerForm, false);
    }
  });
}

updateGoogleButton();
