requireAuth();

const createForm = document.getElementById("createForm");
const mediaFile = document.getElementById("mediaFile");
const imagePreview = document.getElementById("imagePreview");
const videoPreview = document.getElementById("videoPreview");
const createMessage = document.getElementById("createMessage");
const socket = io("/", { auth: { token: getToken() } });

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

const setMessage = (msg, isError = false) => {
  if (!createMessage) return;
  createMessage.textContent = msg || "";
  createMessage.style.color = isError ? "#ef4444" : "";
};

function clearPreviews() {
  if (imagePreview) {
    imagePreview.src = "";
    imagePreview.style.display = "none";
  }
  if (videoPreview) {
    videoPreview.pause?.();
    videoPreview.removeAttribute("src");
    videoPreview.load?.();
    videoPreview.style.display = "none";
  }
}

mediaFile?.addEventListener("change", () => {
  const file = mediaFile.files?.[0];
  clearPreviews();
  setMessage("");
  if (!file) return;

  const url = URL.createObjectURL(file);
  if (String(file.type || "").startsWith("video/")) {
    if (videoPreview) {
      videoPreview.src = url;
      videoPreview.style.display = "block";
    }
  } else {
    if (imagePreview) {
      imagePreview.src = url;
      imagePreview.style.display = "block";
    }
  }
});

createForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMessage("");

  const file = mediaFile?.files?.[0];
  if (!file) return setMessage("Please choose an image or video.", true);

  const btn = createForm.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.dataset.prevText = btn.textContent;
    btn.textContent = "Uploading...";
  }

  try {
    const fd = new FormData(createForm);
    const created = await apiFetch("/posts", { method: "POST", body: fd });
    const isVideo = created?.mediaType === "video";
    setMessage(isVideo ? "Reel uploaded! Redirecting to Reels..." : "Post uploaded! Redirecting to Home...");
    setTimeout(() => {
      window.location.href = isVideo ? "/reels" : "/home";
    }, 600);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.prevText || "Share";
      delete btn.dataset.prevText;
    }
  }
});

socket.on("connect", () => console.log("Create socket connected"));
socket.on("disconnect", () => console.log("Create socket disconnected"));

