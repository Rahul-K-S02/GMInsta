requireAuth();
const conversationsList = document.getElementById("conversationsList");
const friendsList = document.getElementById("friendsList");
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageText");
const chatTitle = document.getElementById("chatTitle");
const me = getMe();
let currentReceiverId = null;
let currentReceiverName = "";
const urlParams = new URLSearchParams(window.location.search);
const userParam = urlParams.get('user');

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

const socket = io("/", { auth: { token: getToken() } });

socket.on("message_received", (msg) => {
  const senderId = String(msg.senderId._id);
  const receiverId = String(msg.receiverId._id);

  if (senderId === currentReceiverId || receiverId === currentReceiverId) {
    renderMessage(msg);
  }

  renderConversations();
  loadFriends();
});

socket.on("message_sent", (msg) => {
  const receiverId = String(msg.receiverId._id);
  const senderId = String(msg.senderId._id);
  if (receiverId === currentReceiverId || senderId === currentReceiverId) {
    renderMessage(msg);
  }

  renderConversations();
  loadFriends();
});

socket.on("connect", () => {
  console.log("Socket connected for messaging");
});

socket.on("disconnect", () => {
  console.log("Socket disconnected");
});

socket.on("follow_update", () => {
  loadFriends();
});

const renderMessage = (msg) => {
  const mine = String(msg.senderId._id) === me.id;
  const who = mine ? "You" : msg.senderId.username;
  chatBox.insertAdjacentHTML("beforeend", `<div class="msg ${mine ? "mine" : "theirs"}"><strong>${who}:</strong> ${msg.messageText}</div>`);
  chatBox.scrollTop = chatBox.scrollHeight;
};

async function getConversationSummaries() {
  try {
    const conversations = await apiFetch("/messages/conversations");
    return conversations;
  } catch (error) {
    console.error("Error loading conversation summaries:", error);
    return [];
  }
}

async function renderConversations() {
  try {
    const conversations = await getConversationSummaries();
    if (!conversations.length) {
      conversationsList.innerHTML = '<p class="muted" style="font-size:12px;">No conversations yet. Start a chat with a friend.</p>';
      return conversations;
    }

    conversationsList.innerHTML = conversations
      .sort((a, b) => new Date(b.lastSentAt) - new Date(a.lastSentAt))
      .map((c) => `
        <div class="friend-item ${currentReceiverId === String(c.userId) ? 'active' : ''}" data-user-id="${c.userId}" data-username="${c.username}" style="cursor:pointer;">
          <img class="avatar" src="${c.profilePic}" alt="${c.username}" />
          <div>
            <div class="friend-row">
              <strong>${c.username}</strong>
              ${c.unreadCount ? `<span class="badge">${c.unreadCount}</span>` : ''}
            </div>
            <p class="muted" style="font-size:12px; margin:0;">${c.lastMessage.length > 45 ? c.lastMessage.slice(0, 45) + '...' : c.lastMessage}</p>
          </div>
        </div>
      `).join("");

    return conversations;
  } catch (error) {
    console.error("Error loading conversations:", error);
    conversationsList.innerHTML = '<p class="muted">Error loading conversations</p>';
    return [];
  }
}

async function autoOpenRecentConversation() {
  if (currentReceiverId) return;

  const conversations = await getConversationSummaries();
  if (!conversations.length) return;

  const recent = conversations
    .sort((a, b) => new Date(b.lastSentAt) - new Date(a.lastSentAt))[0];

  if (recent) {
    selectFriend(String(recent.userId), recent.username);
  }
}

async function loadFriends() {
  try {
    const user = await apiFetch("/users/me");
    const conversationSummaries = await getConversationSummaries();
    const contacts = [];
    const seen = new Set();

    if (user.following && user.following.length) {
      user.following.forEach((f) => {
        seen.add(String(f._id));
        contacts.push({
          ...f,
          relation: "Following",
          unreadCount: conversationSummaries[String(f._id)]?.unreadCount || 0
        });
      });
    }
    if (user.followers && user.followers.length) {
      user.followers.forEach((f) => {
        if (!seen.has(String(f._id))) {
          seen.add(String(f._id));
          contacts.push({
            ...f,
            relation: "Follower",
            unreadCount: conversationSummaries[String(f._id)]?.unreadCount || 0
          });
        }
      });
    }

    if (contacts.length > 0) {
      friendsList.innerHTML = contacts.map(f => `
        <div class="friend-item ${currentReceiverId === f._id ? 'active' : ''}" data-user-id="${f._id}" data-username="${f.username}" style="cursor:pointer;">
          <img class="avatar" src="${f.profilePic}" alt="${f.username}" />
          <div>
            <div class="friend-row">
              <strong>${f.username}</strong>
              ${f.unreadCount ? `<span class="badge">${f.unreadCount}</span>` : ''}
            </div>
            <div class="muted" style="font-size:12px;">${f.relation}</div>
          </div>
        </div>
      `).join("");

      if (!currentReceiverId && contacts.length > 0) {
        selectFriend(contacts[0]._id, contacts[0].username);
      }
    } else {
      friendsList.innerHTML = '<p class="muted" style="font-size:12px;">No contacts yet. Follow or be followed to start chatting!</p>';
    }
  } catch (error) {
    console.error("Error loading friends:", error);
    friendsList.innerHTML = '<p class="muted">Error loading friends</p>';
  }
}

async function selectFriend(userId, username) {
  try {
    currentReceiverId = userId;
    currentReceiverName = username;
    chatTitle.textContent = `Chat with ${username}`;
    const messages = await apiFetch(`/messages/${userId}`);
    chatBox.innerHTML = "";
    messages.forEach(renderMessage);
    messageInput.focus();
    await loadFriends();
  } catch (error) {
    console.error("Error selecting friend:", error);
    chatBox.innerHTML = '<p class="muted">Error loading messages</p>';
  }
}

conversationsList.addEventListener("click", (event) => {
  const item = event.target.closest(".friend-item[data-user-id]");
  if (!item) return;
  selectFriend(item.dataset.userId, item.dataset.username);
});

friendsList.addEventListener("click", (event) => {
  const item = event.target.closest(".friend-item[data-user-id]");
  if (!item) return;
  selectFriend(item.dataset.userId, item.dataset.username);
});

chatForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const messageText = messageInput.value.trim();
  if (!currentReceiverId || !messageText) return;

  try {
    const message = await apiFetch("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: currentReceiverId, messageText })
    });

    renderMessage(message);
    messageInput.value = "";
  } catch (error) {
    console.error("Error sending message:", error);
    alert(error.message || "Unable to send message.");
  }
});

// Refresh sidebar periodically for real-time updates
setInterval(() => {
  renderConversations();
  loadFriends();
}, 15000);

renderConversations().then(() => {
  loadFriends();
  if (!userParam) {
    autoOpenRecentConversation();
  }
});

// Auto-select friend from URL parameter
if (userParam) {
  setTimeout(() => {
    apiFetch("/users/me").then(userData => {
      const contacts = [];
      const seen = new Set();

      if (userData.following) {
        userData.following.forEach((f) => {
          if (!seen.has(f._id)) {
            seen.add(f._id);
            contacts.push(f);
          }
        });
      }
      if (userData.followers) {
        userData.followers.forEach((f) => {
          if (!seen.has(f._id)) {
            seen.add(f._id);
            contacts.push(f);
          }
        });
      }

      const friend = contacts.find(f => f._id === userParam);
      if (friend) {
        selectFriend(friend._id, friend.username);
      }
    }).catch(err => console.error("Error finding friend:", err));
  }, 500);
}
