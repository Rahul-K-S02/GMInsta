requireAuth();
const profileForm = document.getElementById("profileForm");
const profilePic = document.getElementById("profilePic");
const profilePreview = document.getElementById("profilePreview");
const profileCard = document.getElementById("profileCard");
const userSearch = document.getElementById("userSearch");
const searchResults = document.getElementById("searchResults");
const me = getMe();

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

profilePic?.addEventListener("change", () => {
  const file = profilePic.files[0];
  if (!file) return;
  profilePreview.src = URL.createObjectURL(file);
  profilePreview.style.display = "block";
});

async function loadProfile() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId') || 'me';
    const endpoint = userId === 'me' ? '/users/me' : `/users/${userId}`;
    const user = await apiFetch(endpoint);
    const isMe = userId === 'me' || user._id === me.id;
    const isFollowing = user.followers.some(f => f._id === me.id);
    profileCard.innerHTML = `
      <div class="row">
        <img class="avatar" src="${user.profilePic}" alt="profile" />
        <div>
          <h3>${user.username}</h3>
          <p>${user.bio || "No bio yet"}</p>
          <p class="muted">${user.followers.length} followers • ${user.following.length} following</p>
          ${!isMe ? `
            <div style="display:flex; gap:10px; margin-top:10px;">
              <button class="btn" onclick="toggleFollowProfile('${user._id}')">${isFollowing ? 'Unfollow' : 'Follow'}</button>
              <button class="btn" onclick="messageUser('${user._id}', '${user.username}')">Message</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    if (isMe) {
      document.getElementById('editSection').style.display = 'block';
    } else {
      document.getElementById('editSection').style.display = 'none';
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    profileCard.innerHTML = '<p class="muted">Error loading profile</p>';
  }
}

profileForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await apiFetch("/users/me", { method: "PUT", body: new FormData(profileForm) });
  await loadProfile();
  alert("Profile updated");
});

userSearch?.addEventListener("input", async () => {
  const q = userSearch.value.trim();
  if (!q) return (searchResults.innerHTML = "");
  try {
    const users = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
    searchResults.innerHTML = users
      .map(
        (u) => `
        <div class="card user-result">
          <div class="row between">
            <a href="/profile?userId=${u._id}" class="row">
              <img class="avatar" src="${u.profilePic}" />
              <div><strong>${u.username}</strong><div class="muted">${u.bio || ""}</div></div>
            </a>
            <button class="btn-small" onclick="toggleFollowProfile('${u._id}')">Follow</button>
          </div>
        </div>`
      )
      .join("");
  } catch (error) {
    console.error("Error searching users:", error);
    searchResults.innerHTML = '<p class="muted">Error searching users</p>';
  }
});

async function toggleFollowProfile(userId) {
  try {
    const res = await apiFetch(`/users/follow/${userId}`, { method: "POST" });
    await loadProfile();
  } catch (error) {
    console.error("Error following/unfollowing:", error);
    alert("Error: " + error.message);
  }
}

async function messageUser(userId, username) {
  window.location.href = `/chat?user=${userId}`;
}

loadProfile();
