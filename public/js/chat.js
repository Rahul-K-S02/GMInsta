requireAuth();
const friendsList = document.getElementById("friendsList");
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageText");
const chatTitle = document.getElementById("chatTitle");
const me = getMe();
let currentReceiverId = null;
let currentReceiverName = "";

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

const socket = io("/", { auth: { token: getToken() } });

socket.on("message_received", (msg) => {
  if (msg.senderId._id === currentReceiverId || msg.receiverId._id === currentReceiverId) {
    renderMessage(msg);
  }
});

socket.on("message_sent", (msg) => {
  renderMessage(msg);
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
  const mine = msg.senderId._id === me.id;
  const who = mine ? "You" : msg.senderId.username;
  chatBox.insertAdjacentHTML("beforeend", `<div class="msg ${mine ? "mine" : "theirs"}"><strong>${who}:</strong> ${msg.messageText}</div>`);
  chatBox.scrollTop = chatBox.scrollHeight;
};

async function loadFriends() {
  try {
    const user = await apiFetch("/users/me");
    const contacts = [];
    const seen = new Set();

    if (user.following && user.following.length) {
      user.following.forEach((f) => {
        seen.add(String(f._id));
        contacts.push({ ...f, relation: "Following" });
      });
    }
    if (user.followers && user.followers.length) {
      user.followers.forEach((f) => {
        if (!seen.has(String(f._id))) {
          seen.add(String(f._id));
          contacts.push({ ...f, relation: "Follower" });
        }
      });
    }

    if (contacts.length > 0) {
      friendsList.innerHTML = contacts.map(f => `
        <div class="friend-item ${currentReceiverId === f._id ? 'active' : ''}" onclick="selectFriend('${f._id}', '${f.username}')" style="cursor:pointer;">
          <img class="avatar" src="${f.profilePic}" alt="${f.username}" />
          <div>
            <span>${f.username}</span>
            <div class="muted" style="font-size:12px;">${f.relation}</div>
          </div>
        </div>
      `).join("");
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
  } catch (error) {
    console.error("Error selecting friend:", error);
    chatBox.innerHTML = '<p class="muted">Error loading messages</p>';
  }
}

chatForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const messageText = messageInput.value.trim();
  if (!currentReceiverId || !messageText) return;
  socket.emit("private_message", { receiverId: currentReceiverId, messageText });
  messageInput.value = "";
});

// Refresh friends list periodically for real-time updates
setInterval(() => {
  loadFriends();
}, 15000);

loadFriends();

// Auto-select friend from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const userParam = urlParams.get('user');
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
