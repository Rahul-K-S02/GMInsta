requireAuth();
const profileForm = document.getElementById("profileForm");
const profilePic = document.getElementById("profilePic");
const profilePreview = document.getElementById("profilePreview");
const profileCard = document.getElementById("profileCard");
const profilePosts = document.getElementById("profilePosts");
const userSearch = document.getElementById("userSearch");
const searchResults = document.getElementById("searchResults");
const me = getMe() || {};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

async function toggleProfileComments(postId) {
  const list = document.getElementById(`profile-comments-${postId}`);
  const button = document.querySelector(`button[data-action="toggle-profile-comments"][data-post-id="${postId}"]`);
  if (!list || !button) return;

  const isOpen = list.dataset.open === "true";
  if (isOpen) {
    list.dataset.open = "false";
    list.style.display = "none";
    button.textContent = "View comments";
    return;
  }

  if (!list.dataset.loaded) {
    try {
      button.disabled = true;
      const data = await apiFetch(`/comments/${postId}?sort=desc&limit=5`);
      const comments = Array.isArray(data?.comments) ? data.comments : Array.isArray(data) ? data : [];
      list.innerHTML = comments.length
        ? comments
            .map(
              (c) => `
                <div class="profile-comment-item">
                  <strong>${escapeHtml(c.userId?.username || "User")}</strong>
                  <span>${escapeHtml(c.commentText || "")}</span>
                </div>
              `
            )
            .join("")
        : '<div class="muted">No comments yet.</div>';
      list.dataset.loaded = "true";
    } catch (error) {
      console.error("Error loading profile comments:", error);
      list.innerHTML = '<div class="muted">Unable to load comments.</div>';
    } finally {
      button.disabled = false;
    }
  }

  list.dataset.open = "true";
  list.style.display = "block";
  button.textContent = "Hide comments";
}
window.toggleProfileComments = toggleProfileComments;

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
    const postsData = await apiFetch(`/posts/user/${user._id}?page=1&limit=60`);
    const isMe = userId === "me" || user._id === me.id;
    const isFollowing = Array.isArray(user.followers) && user.followers.some((f) => f._id === me.id);
    const posts = Array.isArray(postsData?.posts) ? postsData.posts : [];
    const postsCount = typeof postsData?.totalPosts === "number" ? postsData.totalPosts : posts.length;
    const followersCount = Array.isArray(user.followers) ? user.followers.length : 0;
    const followingCount = Array.isArray(user.following) ? user.following.length : 0;
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
            <span class="profile-stat"><strong>${followersCount}</strong>followers</span>
            <span class="profile-stat"><strong>${followingCount}</strong>following</span>
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
      if (postsCount) {
        postsState.innerHTML = "";
        postsState.style.display = "none";
      } else {
        postsState.style.display = "";
        postsState.innerHTML = `
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.2"/></svg>
          </div>
          <h3>No Posts Yet</h3>
          <p>Share your first photo!</p>
        `;
      }
    }

    if (profilePosts) {
      profilePosts.innerHTML = postsCount
        ? posts
            .map(
              (post) => `
                <div class="profile-post-card">
                  <img src="${post.mediaUrl || post.image || ""}" alt="Post image" />
                  <div class="post-meta">
                    <p>${escapeHtml(post.caption || "")}</p>
                    <span class="muted">${new Date(post.createdAt).toLocaleDateString()}</span>
                    <div class="profile-post-metrics">
                      <span>Like ${post.likesCount ?? 0}</span>
                      <span>Dislike ${post.dislikesCount ?? 0}</span>
                      <span>Comments ${post.commentsCount ?? 0}</span>
                    </div>
                    <button
                      type="button"
                      class="btn-small"
                      data-action="toggle-profile-comments"
                      data-post-id="${post._id}"
                      onclick="toggleProfileComments('${post._id}')"
                    >
                      View comments
                    </button>
                    <div id="profile-comments-${post._id}" class="profile-comment-list" style="display:none;" data-open="false"></div>
                  </div>
                </div>`
            )
            .join("")
        : "";
    }

    if (isMe) {
      document.getElementById("editSection").style.display = "block";
    } else {
      document.getElementById("editSection").style.display = "none";
    }
  } catch (error) {
    console.error("Error loading profile:", error);
    profileCard.innerHTML = '<p class="muted">Error loading profile</p>';
    if (profilePosts) profilePosts.innerHTML = "";
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
    if (typeof window.refreshHeaderAvatar === "function") window.refreshHeaderAvatar();
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
          <button class="btn-small" onclick="toggleFollowProfile('${u._id}')">
  ${u.isFollowing ? "Unfollow" : "Follow"}
</button>
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
    await apiFetch(`/users/follow/${userId}`, { method: "POST" });
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