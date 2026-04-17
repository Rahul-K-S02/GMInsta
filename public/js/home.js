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
const expandedComments = new Set();

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
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
        return c;
    }
  });
}

// Helper functions
function messageFriend(userId, username) {
  window.location.href = `/chat?user=${userId}`;
}
window.messageFriend = messageFriend;

function viewUserProfile(userId) {
  window.location.href = `/profile?userId=${userId}`;
}
window.viewUserProfile = viewUserProfile;

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
        <strong>${escapeHtml(post.userId.username)}</strong>
        <div class="muted">${new Date(post.createdAt).toLocaleString()}</div>
      </div>
    </div>
    <p>${escapeHtml(post.caption)}</p>
    <img class="post-img" src="${post.image}" alt="post" />
    <div class="row post-actions">
      <button type="button" class="btn-small ${post.isLiked ? 'liked' : ''}" data-action="post-react" data-post-id="${post._id}" data-react="like">
        ${post.isLiked ? 'Unlike' : 'Like'} (${post.likesCount ?? post.likes?.length ?? 0})
      </button>
      <button type="button" class="btn-small ${post.isDisliked ? 'disliked' : ''}" data-action="post-react" data-post-id="${post._id}" data-react="dislike">
        ${post.isDisliked ? 'Undislike' : 'Dislike'} (${post.dislikesCount ?? post.dislikes?.length ?? 0})
      </button>
      <button type="button" class="btn-small" data-action="open-comments" data-post-id="${post._id}">Comments</button>
    </div>
    <div class="comments-section">
      <a href="#" id="toggle-comments-${post._id}" class="muted comment-toggle" data-action="toggle-comments" data-post-id="${post._id}" style="display:none;"></a>
      <div id="comments-${post._id}" class="comment-list"></div>
    </div>
    <form class="comment-form" data-post-id="${post._id}">
      <input id="comment-${post._id}" placeholder="Add comment..." />
      <button type="submit">Comment</button>
    </form>
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

function updatePostReactionButtons(postId, state) {
  const likeBtn = document.querySelector(`button[data-action="post-react"][data-post-id="${postId}"][data-react="like"]`);
  const dislikeBtn = document.querySelector(`button[data-action="post-react"][data-post-id="${postId}"][data-react="dislike"]`);

  if (likeBtn) {
    likeBtn.classList.toggle("liked", !!state.isLiked);
    likeBtn.textContent = `${state.isLiked ? "Unlike" : "Like"} (${state.likesCount ?? 0})`;
  }
  if (dislikeBtn) {
    dislikeBtn.classList.toggle("disliked", !!state.isDisliked);
    dislikeBtn.textContent = `${state.isDisliked ? "Undislike" : "Dislike"} (${state.dislikesCount ?? 0})`;
  }
}

async function react(postId, action) {
  try {
    const response = await apiFetch(`/posts/${postId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    updatePostReactionButtons(postId, response);
  } catch (error) {
    console.error("Error reacting to post:", error);
    alert(error.message || "Unable to react to post.");
  }
}

async function addComment(e, postId) {
  e.preventDefault();
  const input = document.getElementById(`comment-${postId}`);
  const form = input?.closest("form");
  const submitButton = form?.querySelector('button[type="submit"]');
  const text = (input?.value || "").trim();
  if (!text) return;

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";
    }

    await apiFetch(`/comments/${postId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentText: text })
    });

    expandedComments.add(String(postId));
    input.value = "";
    await loadComments(postId);
    await loadNotifications();
  } catch (error) {
    console.error("Error adding comment:", error);
    alert(error.message || "Unable to save comment.");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Comment";
    }
  }
}

async function loadComments(postId) {
  try {
    const isExpanded = expandedComments.has(String(postId));
    const query = "sort=asc";
    const data = await apiFetch(`/comments/${postId}?${query}`);

    // Backward compatible: older API returned an array, newer returns { total, comments }.
    const total = Array.isArray(data) ? data.length : (data.total || 0);
    const comments = Array.isArray(data) ? data : (Array.isArray(data.comments) ? data.comments : []);
    const list = document.getElementById(`comments-${postId}`);
    const toggle = document.getElementById(`toggle-comments-${postId}`);
    if (!list) return;

    list.innerHTML = isExpanded
      ? (comments.length
          ? comments
          .map(
            (c) => `<div class="comment-item">
              <strong>${escapeHtml(c.userId?.username || "User")}</strong>
              <span>${escapeHtml(c.commentText)}</span>
            </div>`
          )
          .join("")
          : '<div class="muted">No comments yet.</div>')
      : "";

    if (toggle) {
      if (total <= 0) {
        toggle.style.display = "none";
      } else if (isExpanded) {
        toggle.style.display = "inline-block";
        toggle.textContent = "Hide comments";
      } else {
        toggle.style.display = "inline-block";
        toggle.textContent = total === 1 ? "View 1 comment" : `View all ${total} comments`;
      }
    }
  } catch (error) {
    console.error("Error loading comments:", error);
    const list = document.getElementById(`comments-${postId}`);
    if (list) list.innerHTML = '<div class="muted">Unable to load comments.</div>';
  }
}

async function reactComment(commentId, action, postId) {
  await apiFetch(`/comments/${commentId}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  });
  loadComments(postId);
}
window.reactComment = reactComment;

async function loadFriends() {
  try {
    const user = await apiFetch("/users/me");
    if (user.following && user.following.length > 0) {
      friendsList.innerHTML = user.following.map(f => `
        <div class="friend-item">
          <img class="avatar" src="${f.profilePic}" alt="${f.username}" />
          <div class="friend-info">
            <strong onclick="viewUserProfile('${f._id}')" style="cursor:pointer;">${f.username}</strong>
            <a class="btn-small msg-btn" href="/chat?user=${f._id}">Message</a>
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

async function loadNotifications() {
  try {
    const notifications = await apiFetch("/notifications");
    if (!notificationsList) return;

    if (!notifications.length) {
      notificationsList.innerHTML = '<p class="muted" style="font-size:12px;">No notifications yet.</p>';
      return;
    }

    notificationsList.innerHTML = notifications
      .slice(0, 20)
      .map((n) => {
        const actor = n.actorId?.username || "Someone";
        const action = n.type === "comment" ? "commented on" : "liked";
        const when = new Date(n.createdAt).toLocaleString();
        return `<div class="muted" style="font-size:12px; margin-bottom:8px;">
          <strong>${actor}</strong> ${action} your post - ${when}
        </div>`;
      })
      .join("");
  } catch (error) {
    console.error("Error loading notifications:", error);
    if (notificationsList) notificationsList.innerHTML = '<p class="muted" style="font-size:12px;">Error loading notifications</p>';
  }
}
window.loadNotifications = loadNotifications;

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
                <a class="btn-small msg-btn" href="/chat?user=${u._id}">Message</a>
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

  // Refresh friends/users quickly on first load, then slow down.
  // Fast: every 3s for the first 6s, then every 30s.
  let refreshIntervalId = null;
  const startRefreshLoop = (ms) => {
    if (refreshIntervalId) clearInterval(refreshIntervalId);
    refreshIntervalId = setInterval(() => {
      loadFriends();
      loadExploreUsers();
    }, ms);
  };

  startRefreshLoop(3000);
  setTimeout(() => startRefreshLoop(30000), 3000);

  document.addEventListener("click", (event) => {
    const btn = event.target.closest('button[data-action="post-react"][data-post-id][data-react]');
    if (!btn) return;
    const postId = btn.dataset.postId;
    const action = btn.dataset.react;
    if (!postId || !action) return;
    react(postId, action);
  });

  document.addEventListener("click", (event) => {
    const btn = event.target.closest('button[data-action="open-comments"][data-post-id]');
    if (!btn) return;
    const postId = String(btn.dataset.postId);
    if (!postId) return;
    expandedComments.add(postId);
    loadComments(postId);
    const input = document.getElementById(`comment-${postId}`);
    input?.focus();
  });

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest('a[data-action="toggle-comments"][data-post-id]');
    if (!toggle) return;
    event.preventDefault();
    const postId = String(toggle.dataset.postId);
    if (!postId) return;
    if (expandedComments.has(postId)) expandedComments.delete(postId);
    else expandedComments.add(postId);
    loadComments(postId);
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form.comment-form[data-post-id]");
    if (!form) return;
    const postId = String(form.dataset.postId || "");
    if (!postId) return;
    addComment(event, postId);
  });

  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 150) loadPosts();
  });

  loadPosts();
  loadNotifications();
  loadFriends();
  loadExploreUsers();
