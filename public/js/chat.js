requireAuth();
const otherUserIdInput = document.getElementById("otherUserId");
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageText");
const loadChatBtn = document.getElementById("loadChatBtn");
const me = getMe();

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

const socket = io("/", { auth: { token: getToken() } });
socket.on("message_received", (msg) => renderMessage(msg));
socket.on("message_sent", (msg) => renderMessage(msg));

const renderMessage = (msg) => {
  const who = msg.senderId._id === me.id ? "You" : msg.senderId.username;
  chatBox.insertAdjacentHTML("beforeend", `<div class="msg"><strong>${who}:</strong> ${msg.messageText}</div>`);
  chatBox.scrollTop = chatBox.scrollHeight;
};

loadChatBtn?.addEventListener("click", async () => {
  const otherUserId = otherUserIdInput.value.trim();
  if (!otherUserId) return;
  const messages = await apiFetch(`/messages/${otherUserId}`);
  chatBox.innerHTML = "";
  messages.forEach(renderMessage);
});

chatForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const receiverId = otherUserIdInput.value.trim();
  const messageText = messageInput.value.trim();
  if (!receiverId || !messageText) return;
  socket.emit("private_message", { receiverId, messageText });
  messageInput.value = "";
});
