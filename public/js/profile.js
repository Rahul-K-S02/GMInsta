requireAuth();
const profileForm = document.getElementById("profileForm");
const profilePic = document.getElementById("profilePic");
const profilePreview = document.getElementById("profilePreview");
const profileCard = document.getElementById("profileCard");
const userSearch = document.getElementById("userSearch");
const searchResults = document.getElementById("searchResults");
const me = getMe() || {};

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
    const userId = urlParams.get("userId") || "me";
    const endpoint = userId === "me" ? "/users/me" : `/users/${userId}`;
    const user = await apiFetch(endpoint);
    const isMe = userId === "me" || user._id === me.id;
    const isFollowing = user.followers.some((f) => f._id === me.id);
    const postsCount = Array.isArray(user.links?.posts) ? user.links.posts.length : 0;
    const postsState = document.getElementById("profilePostsState");
    profileCard.innerHTML = `
      <div class="profile-header">
        <img class="profile-avatar" src="${user.profilePic}" alt="profile" />
        <div class="profile-meta">
          <div class="profile-title-row">
            <h2>${user.username}</h2>
            ${isMe ? `<button type="button" class="btn-small" onclick="document.getElementById('editSection')?.scrollIntoView({ behavior: 'smooth' })">Edit Profile</button>` : ""}
          </div>
          <div class="profile-stats">
            <span class="profile-stat"><strong>${postsCount}</strong>posts</span>
            <span class="profile-stat"><strong>${user.followers.length}</strong>followers</span>
            <span class="profile-stat"><strong>${user.following.length}</strong>following</span>
          </div>
          <p class="profile-bio"><strong>${user.username}</strong><br />${user.bio || "No bio yet"}</p>
          ${!isMe ? `
            <div class="user-actions">
              <button class="btn-small" onclick="toggleFollowProfile('${user._id}')">${isFollowing ? "Unfollow" : "Follow"}</button>
              <button class="btn-small" onclick="messageUser('${user._id}', '${user.username}')">Message</button>
            </div>
          ` : ""}
        </div>
      </div>
    `;
    if (postsState) {
      postsState.innerHTML = postsCount
        ? `<div class="muted">${postsCount} post${postsCount === 1 ? "" : "s"} available. Profile feed can be extended here later.</div>`
        : `
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.2"/></svg>
          </div>
          <h3>No Posts Yet</h3>
          <p>Share your first photo!</p>
        `;
    }
    if (isMe) {
      document.getElementById("editSection").style.display = "block";
    } else {
      document.getElementById("editSection").style.display = "none";
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    profileCard.innerHTML = '<p class="muted">Error loading profile</p>';
  }
}

profileForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const response = await apiFetch("/users/me", { method: "PUT", body: new FormData(profileForm) });
  if (response?.user) {
    localStorage.setItem("user", JSON.stringify({
      ...(getMe() || {}),
      id: response.user._id || (getMe() || {}).id,
      username: response.user.username,
      email: response.user.email,
      bio: response.user.bio,
      profilePic: response.user.profilePic
    }));
  }
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
        <div class="search-result-card user-result">
          <div class="search-result-main">
            <a href="/profile?userId=${u._id}" class="row">
              <img class="avatar" src="${u.profilePic}" />
              <div><strong>${u.username}</strong><div class="muted">${u.bio || ""}</div></div>
            </a>
          </div>
          <button class="btn-small" onclick="toggleFollowProfile('${u._id}')">Follow</button>
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
