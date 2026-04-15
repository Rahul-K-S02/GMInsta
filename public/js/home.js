requireAuth();
const postForm = document.getElementById("postForm");
const postImage = document.getElementById("postImage");
const imagePreview = document.getElementById("imagePreview");
const feed = document.getElementById("feed");
const notificationsList = document.getElementById("notifications");
const friendsList = document.getElementById("friendsList");
const exploreUsers = document.getElementById("exploreUsers");
const me = getMe();
const socket = io("/", { auth: { token: getToken() } });

let page = 1;
let hasMore = true;
let isLoading = false;

socket.on("connect", () => {
  console.log("Home socket connected");
});

socket.on("disconnect", () => {
  console.log("Home socket disconnected");
});

socket.on("follow_update", async () => {
  await loadFriends();
  await loadExploreUsers();
});

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

postImage?.addEventListener("change", () => {
  const file = postImage.files[0];
  if (!file) return;
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.style.display = "block";
});

postForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(postForm);
  try {
    await apiFetch("/posts", { method: "POST", body: fd });
    postForm.reset();
    imagePreview.style.display = "none";
    feed.innerHTML = "";
    page = 1;
    hasMore = true;
    loadPosts();
  } catch (error) {
    alert(error.message);
  }
});

const renderPost = (post) => `
  <article class="card post-card">
    <div class="row post-head">
      <img class="avatar" src="${post.userId.profilePic}" alt="avatar" />
      <div>
        <strong>${post.userId.username}</strong>
        <div class="muted">${new Date(post.createdAt).toLocaleString()}</div>
      </div>
    </div>
    <p>${post.caption}</p>
    <img class="post-img" src="${post.image}" alt="post" />
    <div class="row post-actions">
      <button onclick="react('${post._id}')">Like (${post.likes.length})</button>
    </div>
    <form class="comment-form" onsubmit="addComment(event, '${post._id}')">
      <input id="comment-${post._id}" placeholder="Add comment..." />
      <button type="submit">Comment</button>
    </form>
    <div id="comments-${post._id}" class="comment-list"></div>
  </article>
`;

async function loadPosts() {
  if (!hasMore || isLoading) return;
  isLoading = true;
  try {
    const data = await apiFetch(`/posts?page=${page}&limit=5`);
    data.posts.forEach((post) => {
      feed.insertAdjacentHTML("beforeend", renderPost(post));
      loadComments(post._id);
    });
    hasMore = page < data.totalPages;
    page += 1;
  } catch (error) {
    console.error(error.message);
  } finally {
    isLoading = false;
  }
}

async function react(postId) {
  await apiFetch(`/posts/${postId}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "like" })
  });
  feed.innerHTML = "";
  page = 1;
  hasMore = true;
  loadPosts();
}

async function addComment(e, postId) {
  e.preventDefault();
  const input = document.getElementById(`comment-${postId}`);
  await apiFetch(`/comments/${postId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commentText: input.value.trim() })
  });
  input.value = "";
  loadComments(postId);
  loadNotifications();
}

async function loadComments(postId) {
  const comments = await apiFetch(`/comments/${postId}`);
  const list = document.getElementById(`comments-${postId}`);
  list.innerHTML = comments
    .map(
      (c) => `<div class="comment-item">
        <strong>${c.userId.username}</strong> <span>${c.commentText}</span>
        <button onclick="reactComment('${c._id}','like','${postId}')">Like (${c.likesCount || 0})</button>
        <button onclick="reactComment('${c._id}','dislike','${postId}')">Dislike (${c.dislikesCount || 0})</button>
      </div>`
    )
    .join("");
}

async function reactComment(commentId, action, postId) {
  await apiFetch(`/comments/${commentId}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  });
  loadComments(postId);
}

async function loadFriends() {
  try {
    const user = await apiFetch("/users/me");
    if (user.following && user.following.length > 0) {
      friendsList.innerHTML = user.following.map(f => `
        <div class="friend-item">
          <img class="avatar" src="${f.profilePic}" alt="${f.username}" />
          <div class="friend-info">
            <strong onclick="viewUserProfile('${f._id}')" style="cursor:pointer;">${f.username}</strong>
            <button class="btn-small msg-btn" onclick="messageFriend('${f._id}', '${f.username}')">Message</button>
          </div>
        </div>
      `).join("");
    } else {
      friendsList.innerHTML = '<p class="muted" style="font-size:12px;">No friends yet. Follow users below!</p>';
    }
  } catch (error) {
    console.error("Error loading friends:", error);
    friendsList.innerHTML = '<p class="muted">Error loading friends</p>';
  }
}

async function loadExploreUsers() {
  try {
    exploreUsers.innerHTML = '<p class="muted" style="padding:10px;">Loading suggested users...</p>';
    const suggestedUsers = await apiFetch("/users/discover?limit=15");

    if (suggestedUsers && suggestedUsers.length > 0) {
      exploreUsers.innerHTML = suggestedUsers.map(u => {
        const isFollowing = u.isFollowing;
        const isFollower = u.isFollower;
        const relationLabel = isFollowing ? 'Following' : isFollower ? 'Follower' : 'Suggested';
        const canMessage = isFollowing || isFollower;
        const mutualLabel = u.mutualFriendsCount > 0 ? `${u.mutualFriendsCount} mutual friend${u.mutualFriendsCount === 1 ? '' : 's'}` : '';

        return `
          <div class="user-item" id="user-${u._id}">
            <img class="avatar" src="${u.profilePic}" alt="${u.username}" />
            <div class="user-info">
              <strong onclick="viewUserProfile('${u._id}')" style="cursor:pointer;">${u.username}</strong>
              <p class="muted" style="font-size:12px; margin:4px 0;">${u.bio || 'No bio'}</p>
              <p class="muted" style="font-size:12px;">${relationLabel} ${mutualLabel ? '• ' + mutualLabel : ''} • ${u.followersCount || 0} followers • ${u.followingCount || 0} following</p>
              <div class="row" style="gap:8px; flex-wrap:wrap; margin-top:6px;">
                <a href="#" class="btn-small follow-btn" data-action="toggle-follow" data-user-id="${u._id}">${isFollowing ? 'Unfollow' : 'Follow'}</a>
                ${canMessage ? `<button class="btn-small msg-btn" onclick="messageFriend('${u._id}', '${u.username}')">Message</button>` : ''}
              </div>
            </div>
          </div>
        `;
      }).join("");
    } else {
      exploreUsers.innerHTML = '<p class="muted" style="font-size:12px; padding:10px;">No users found for explore.</p>';
    }
  } catch (error) {
    console.error("Error loading explore users:", error);
    exploreUsers.innerHTML = '<p class="muted" style="padding:10px;">Error loading users: ' + error.message + '</p>';
  }
}

  async function toggleFollow(userId, element) {
    try {
      const isFollowing = element.textContent.trim() === 'Unfollow';
      element.classList.add('disabled');
      element.textContent = isFollowing ? 'Unfollowing...' : 'Following...';

      await apiFetch(`/users/follow/${userId}`, { method: "POST" });
      
      await loadFriends();
      await loadExploreUsers();
    } catch (error) {
      element.classList.remove('disabled');
      element.textContent = element.textContent.replace('Following...', 'Follow').replace('Unfollowing...', 'Unfollow');
      console.error("Error toggling follow:", error);
      alert("Error: " + error.message);
    }
  }

  exploreUsers.addEventListener('click', async (event) => {
    const followLink = event.target.closest('[data-action="toggle-follow"]');
    if (!followLink) return;
    event.preventDefault();
    const userId = followLink.dataset.userId;
    if (userId) await toggleFollow(userId, followLink);
  });

  function messageFriend(userId, username) {
    window.location.href = `/chat?user=${userId}`;
  }

  function viewUserProfile(userId) {
    window.location.href = `/profile?userId=${userId}`;
  }

  // Refresh friends and users every 30 seconds for real-time updates
  setInterval(() => {
    loadFriends();
    loadExploreUsers();
  }, 30000);

  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 150) loadPosts();
  });

  loadPosts();
  loadNotifications();
  loadFriends();
  loadExploreUsers();

  window.toggleFollow = toggleFollow;
  window.viewUserProfile = viewUserProfile;
