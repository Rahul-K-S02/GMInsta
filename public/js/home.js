requireAuth();
const postForm = document.getElementById("postForm");
const postImage = document.getElementById("postImage");
const imagePreview = document.getElementById("imagePreview");
const feed = document.getElementById("feed");
const notificationsList = document.getElementById("notifications");
const friendsList = document.getElementById("friendsList");
const exploreUsers = document.getElementById("exploreUsers");
const storiesRail = document.getElementById("storiesRail");
const addStoryBtn = document.getElementById("addStoryBtn");
const watchAllStoriesBtn = document.getElementById("watchAllStoriesBtn");
const storyInput = document.getElementById("storyInput");
const storyViewer = document.getElementById("storyViewer");
const storyProgress = document.getElementById("storyProgress");
const storyViewerAvatar = document.getElementById("storyViewerAvatar");
const storyViewerName = document.getElementById("storyViewerName");
const storyViewerTime = document.getElementById("storyViewerTime");
const storyViewerImage = document.getElementById("storyViewerImage");
const storyViewerVideo = document.getElementById("storyViewerVideo");
const closeStoryViewerBtn = document.getElementById("closeStoryViewer");
const storyPrevBtn = document.getElementById("storyPrev");
const storyNextBtn = document.getElementById("storyNext");
const me = getMe() || {};
const socket = io("/", { auth: { token: getToken() } });

let page = 1;
let hasMore = true;
let isLoading = false;
const expandedComments = new Set();
let storiesCache = [];
let activeStoryUserId = null;
let activeStoryIndex = 0;
let storyImageTimer = null;

function renderHomeProfileCard() {
  const name = document.getElementById("homeProfileName");
  const handle = document.getElementById("homeProfileHandle");
  const avatar = document.getElementById("homeProfileAvatar");
  if (name) name.textContent = me.username || "Your profile";
  if (handle) handle.textContent = me.email || "View your updates";
  if (avatar) avatar.textContent = String(me.username || "G").charAt(0).toUpperCase();
}

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

function timeAgo(value) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

function getProfileHref(user) {
  const userId = user?._id || user?.id;
  return userId ? `/profile?userId=${userId}` : "/profile";
}

function reactionButtonMarkup({ type, active, count }) {
  const isLike = type === "like";
  const icon = isLike ? "&#128077;" : "&#128078;";
  const actionLabel = isLike ? "like" : "dislike";
  const activeClass = active ? (isLike ? "liked" : "disliked") : "";
  return `
    <button
      type="button"
      class="btn-small reaction-btn ${activeClass}"
      data-action="post-react"
      data-post-id="${count.postId}"
      data-react="${type}"
      aria-label="${active ? "Undo" : "Add"} ${actionLabel}"
      title="${active ? "Undo" : "Add"} ${actionLabel}"
    >
      <span class="reaction-icon" aria-hidden="true">${icon}</span>
      <span class="reaction-count">${count.value}</span>
    </button>
  `;
}

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

socket.on("story_created", async () => {
  await loadStories();
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

const renderPost = (post) => {
  const mediaType = post.mediaType || "image";
  const mediaUrl = post.mediaUrl || post.image || "/public/images/default-avatar.svg";
  const likeCount = post.likesCount ?? post.likes?.length ?? 0;
  const dislikeCount = post.dislikesCount ?? post.dislikes?.length ?? 0;
  const profileHref = getProfileHref(post.userId);
  const likeButton = reactionButtonMarkup({
    type: "like",
    active: !!post.isLiked,
    count: { postId: post._id, value: likeCount }
  });
  const dislikeButton = reactionButtonMarkup({
    type: "dislike",
    active: !!post.isDisliked,
    count: { postId: post._id, value: dislikeCount }
  });
  console.log("Rendering post media:", post._id, mediaType, mediaUrl);
  const mediaMarkup =
    mediaType === "video"
      ? `<video class="post-video" src="${mediaUrl}" controls playsinline preload="metadata"></video>`
      : `<img class="post-img" src="${mediaUrl}" alt="post" onerror="console.error('Post image load failed:', this.src); this.src='/public/images/default-avatar.svg'" />`;
  return `
  <article class="card post-card">
    <div class="row post-head">
      <a href="${profileHref}" class="profile-link" aria-label="Open ${escapeHtml(post.userId?.username || "user")} profile">
        <img class="avatar" src="${post.userId?.profilePic || '/public/images/default-avatar.svg'}" alt="avatar" onerror="console.error('Avatar load failed:', this.src); this.src='/public/images/default-avatar.svg'" />
      </a>
      <div>
        <strong><a href="${profileHref}" class="profile-link">${escapeHtml(post.userId?.username || 'Unknown')}</a></strong>
        <div class="muted">${new Date(post.createdAt).toLocaleString()}</div>
      </div>
    </div>
    <p>${escapeHtml(post.caption)}</p>
    ${mediaMarkup}
    <div class="row post-actions">
      ${likeButton}
      ${dislikeButton}
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
};

const renderEmptyFeed = () => `
  <div class="card empty-state">
    <div class="empty-state-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.2"/></svg>
    </div>
    <div>
      <h3>No Posts Yet</h3>
      <p>Be the first to share a moment!</p>
    </div>
    <button type="button" onclick="window.location.href='/create'">Create Post</button>
  </div>
`;

async function loadPosts() {
  if (!hasMore || isLoading) return;
  isLoading = true;
  try {
    const data = await apiFetch(`/posts?page=${page}&limit=5`);
    console.log('Loaded feed page', page, 'posts', data.posts?.length, 'images', data.posts?.map(p => p.image));
    if (page === 1 && (!data.posts || !data.posts.length)) {
      feed.innerHTML = renderEmptyFeed();
      hasMore = false;
      return;
    }
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
    likeBtn.innerHTML = `<span class="reaction-icon" aria-hidden="true">&#128077;</span><span class="reaction-count">${state.likesCount ?? 0}</span>`;
    likeBtn.setAttribute("aria-label", `${state.isLiked ? "Undo" : "Add"} like`);
    likeBtn.setAttribute("title", `${state.isLiked ? "Undo" : "Add"} like`);
  }
  if (dislikeBtn) {
    dislikeBtn.classList.toggle("disliked", !!state.isDisliked);
    dislikeBtn.innerHTML = `<span class="reaction-icon" aria-hidden="true">&#128078;</span><span class="reaction-count">${state.dislikesCount ?? 0}</span>`;
    dislikeBtn.setAttribute("aria-label", `${state.isDisliked ? "Undo" : "Add"} dislike`);
    dislikeBtn.setAttribute("title", `${state.isDisliked ? "Undo" : "Add"} dislike`);
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
              <strong><a class="profile-link" href="${getProfileHref(c.userId)}">${escapeHtml(c.userId?.username || "User")}</a></strong>
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

function clearStoryTimers() {
  if (storyImageTimer) {
    clearTimeout(storyImageTimer);
    storyImageTimer = null;
  }
  if (storyViewerVideo) {
    storyViewerVideo.onended = null;
  }
}

function getActiveStoryGroup() {
  return storiesCache.find((item) => String(item.userId) === String(activeStoryUserId));
}

function renderStoryProgress(group, currentIndex) {
  if (!storyProgress) return;
  const total = Array.isArray(group?.stories) ? group.stories.length : 0;
  storyProgress.innerHTML = Array.from({ length: total }, (_, idx) => {
    const cls = idx < currentIndex ? "done" : idx === currentIndex ? "active" : "";
    return `<span class="story-progress-segment ${cls}"></span>`;
  }).join("");
}

async function markViewed(storyId) {
  try {
    await apiFetch(`/posts/stories/${storyId}/view`, { method: "POST" });
  } catch (error) {
    console.error("Unable to mark story viewed:", error.message);
  }
}

function closeStoryViewer() {
  clearStoryTimers();
  if (storyViewerVideo) {
    storyViewerVideo.pause();
    storyViewerVideo.removeAttribute("src");
    storyViewerVideo.load();
  }
  if (storyViewer) {
    storyViewer.classList.remove("open");
    storyViewer.setAttribute("aria-hidden", "true");
  }
  activeStoryUserId = null;
  activeStoryIndex = 0;
}

async function showStoryAt(index) {
  const group = getActiveStoryGroup();
  if (!group || !Array.isArray(group.stories) || !group.stories.length) {
    closeStoryViewer();
    return;
  }

  if (index < 0) index = 0;
  if (index >= group.stories.length) {
    closeStoryViewer();
    await loadStories();
    return;
  }

  activeStoryIndex = index;
  const story = group.stories[activeStoryIndex];
  clearStoryTimers();
  renderStoryProgress(group, activeStoryIndex);

  if (storyViewerAvatar) storyViewerAvatar.src = group.profilePic || "/public/images/default-avatar.svg";
  if (storyViewerName) storyViewerName.textContent = group.username || "Story";
  if (storyViewerTime) storyViewerTime.textContent = timeAgo(story.createdAt);

  if (story.mediaType === "video") {
    if (storyViewerImage) storyViewerImage.style.display = "none";
    if (storyViewerVideo) {
      storyViewerVideo.style.display = "block";
      storyViewerVideo.src = story.mediaUrl;
      storyViewerVideo.currentTime = 0;
      storyViewerVideo.play().catch(() => {});
      storyViewerVideo.onended = () => {
        showStoryAt(activeStoryIndex + 1);
      };
    }
  } else {
    if (storyViewerVideo) {
      storyViewerVideo.pause();
      storyViewerVideo.removeAttribute("src");
      storyViewerVideo.load();
      storyViewerVideo.style.display = "none";
    }
    if (storyViewerImage) {
      storyViewerImage.style.display = "block";
      storyViewerImage.src = story.mediaUrl;
    }
    storyImageTimer = setTimeout(() => {
      showStoryAt(activeStoryIndex + 1);
    }, 5000);
  }

  if (!story.isViewed) {
    await markViewed(story._id);
    story.isViewed = true;
  }

  updateStoryHeartButton(story);
}

function updateStoryHeartButton(story) {
  const heartBtn = document.getElementById("storyHeartBtn");
  const heartCount = document.getElementById("storyHeartCount");
  if (!heartBtn || !heartCount || !story) return;

  heartBtn.classList.toggle("liked", !!story.isLiked);
  heartBtn.setAttribute("aria-label", `${story.isLiked ? "Unlike" : "Like"} story`);
  heartBtn.title = `${story.isLiked ? "Unlike" : "Like"} story`;
  heartCount.textContent = String(story.likesCount ?? 0);
}

async function toggleStoryLike() {
  const group = getActiveStoryGroup();
  if (!group || !group.stories?.length) return;
  const story = group.stories[activeStoryIndex];
  if (!story?._id) return;

  try {
    const response = await apiFetch(`/posts/${story._id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like" })
    });

    story.likesCount = response.likesCount ?? story.likesCount ?? 0;
    story.isLiked = !!response.isLiked;
    updateStoryHeartButton(story);
  } catch (error) {
    alert(error.message || "Unable to like story.");
  }
}

async function openStoryViewer(userId) {
  try {
    const stories = await apiFetch(`/posts/stories/${userId}`);
    if (!Array.isArray(stories) || !stories.length) return;

    const base = storiesCache.find((item) => String(item.userId) === String(userId));
    const group = {
      userId,
      username: base?.username || stories[0]?.userId?.username || "Story",
      profilePic: base?.profilePic || stories[0]?.userId?.profilePic || "/public/images/default-avatar.svg",
      stories
    };

    storiesCache = storiesCache.filter((item) => String(item.userId) !== String(userId));
    storiesCache.unshift(group);

    activeStoryUserId = userId;
    activeStoryIndex = 0;
    if (storyViewer) {
      storyViewer.classList.add("open");
      storyViewer.setAttribute("aria-hidden", "false");
    }
    await showStoryAt(0);
  } catch (error) {
    console.error("Unable to open story viewer:", error);
  }
}

function renderStoriesRail(items) {
  if (!storiesRail) return;
  const selfStory = items.find((item) => String(item.userId) === String(me.id));
  const normalizedItems = items.filter((item) => String(item.userId) !== String(me.id));
  const selfProfile = {
    userId: me.id,
    username: me.username || "You",
    profilePic: me.profilePic || "/public/images/default-avatar.svg"
  };

  const renderSelfTile = () => {
    if (selfStory) {
      return `
        <div class="story-tile story-self-tile">
          <button type="button" class="story-item story-self-open" data-action="open-story" data-user-id="${selfProfile.userId}">
            <span class="story-ring story-ring-own ${selfStory.hasUnseen ? "" : "seen"}">
              <img class="story-avatar" src="${selfProfile.profilePic}" alt="${escapeHtml(selfProfile.username)}" />
              <span class="story-plus-badge story-add-badge" data-action="add-story" role="button" tabindex="0" aria-label="Add another story" title="Add another story">+</span>
            </span>
            <span class="story-label">${escapeHtml(selfProfile.username)}</span>
          </button>
        </div>
      `;
    }

    return `
      <button type="button" class="story-item story-add story-self-add" data-action="add-story">
        <span class="story-ring story-ring-add">
          <img class="story-avatar" src="${selfProfile.profilePic}" alt="${escapeHtml(selfProfile.username)}" />
          <span class="story-plus-badge" aria-hidden="true">+</span>
        </span>
        <span class="story-label">${escapeHtml(selfProfile.username)}</span>
      </button>
    `;
  };

  const tiles = [renderSelfTile(), ...normalizedItems.map((item) => {
    const seenClass = item.hasUnseen ? "" : "seen";
    return `
      <button type="button" class="story-item ${seenClass}" data-action="open-story" data-user-id="${item.userId}">
        <span class="story-ring">
          <img class="story-avatar" src="${item.profilePic || "/public/images/default-avatar.svg"}" alt="${escapeHtml(item.username)}" />
        </span>
        <span class="story-label">${escapeHtml(item.username || "User")}</span>
      </button>
    `;
  })];

  storiesRail.innerHTML = tiles.length ? tiles.join("") : '<div class="story-empty">No stories yet. Tap your photo to add one.</div>';
}

async function loadStories() {
  try {
    const usersWithStories = await apiFetch("/posts/stories");
    storiesCache = Array.isArray(usersWithStories)
      ? usersWithStories.map((entry) => ({ ...entry, stories: [] }))
      : [];
    renderStoriesRail(storiesCache);
  } catch (error) {
    console.error("Error loading stories:", error);
    if (storiesRail) storiesRail.innerHTML = '<div class="story-empty">Unable to load stories.</div>';
  }
}

async function watchAllStories() {
  const nextStory = storiesCache.find((item) => String(item.userId) !== String(me.id) && Array.isArray(item.stories) && item.stories.length);
  if (!nextStory) return;
  await openStoryViewer(nextStory.userId);
}

async function uploadStory(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append("image", file);
  fd.append("caption", "Story");
  try {
    await apiFetch("/posts/stories", { method: "POST", body: fd });
    await loadStories();
  } catch (error) {
    alert(error.message || "Unable to upload story.");
  }
}

async function uploadMultipleStories(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;

  for (const file of files) {
    // Upload each selected file as its own story so the strip can show multiple entries.
    await uploadStory(file);
  }
  await loadStories();
}

async function loadFriends() {
  try {
    const user = await apiFetch("/users/me");
    if (user.following && user.following.length > 0) {
      friendsList.innerHTML = user.following.map(f => `
        <div class="friend-item">
          <a href="/profile?userId=${f._id}" class="profile-link" aria-label="Open ${escapeHtml(f.username)} profile">
            <img class="avatar" src="${f.profilePic}" alt="${f.username}" />
          </a>
          <div class="friend-info">
            <strong><a class="profile-link" href="/profile?userId=${f._id}">${escapeHtml(f.username)}</a></strong>
            <div class="muted">Friend</div>
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
        return `<div class="notification-item">
          <div>
            <strong>${actor}</strong>
            <div class="muted">${action} your post</div>
            <div class="muted">${when}</div>
          </div>
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
            <a href="/profile?userId=${u._id}" class="profile-link" aria-label="Open ${escapeHtml(u.username)} profile">
              <img class="avatar" src="${u.profilePic}" alt="${u.username}" />
            </a>
            <div class="user-info">
              <strong><a class="profile-link" href="/profile?userId=${u._id}">${escapeHtml(u.username)}</a></strong>
              <p class="muted" style="font-size:12px; margin:4px 0;">${escapeHtml(u.bio || 'No bio')}</p>
              <p class="muted" style="font-size:12px;">${relationLabel}${mutualLabel ? ` • ${mutualLabel}` : ""} • ${u.followersCount || 0} followers • ${u.followingCount || 0} following</p>
              <div class="user-actions">
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

  storiesRail?.addEventListener("click", async (event) => {
    const btn = event.target.closest('button[data-action="open-story"][data-user-id]');
    if (!btn) return;
    const userId = btn.dataset.userId;
    if (!userId) return;
    await openStoryViewer(userId);
  });

  storiesRail?.addEventListener("click", (event) => {
    const btn = event.target.closest('[data-action="add-story"]');
    if (!btn) return;
    storyInput?.click();
  });

  storiesRail?.addEventListener("keydown", (event) => {
    const target = event.target.closest('[data-action="add-story"]');
    if (!target) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    storyInput?.click();
  });

  watchAllStoriesBtn?.addEventListener("click", watchAllStories);
  addStoryBtn?.addEventListener("click", () => storyInput?.click());

  storyInput?.addEventListener("change", async () => {
    await uploadMultipleStories(storyInput.files);
    storyInput.value = "";
  });

  closeStoryViewerBtn?.addEventListener("click", closeStoryViewer);
  storyPrevBtn?.addEventListener("click", () => showStoryAt(activeStoryIndex - 1));
  storyNextBtn?.addEventListener("click", () => showStoryAt(activeStoryIndex + 1));
  document.getElementById("storyHeartBtn")?.addEventListener("click", toggleStoryLike);

  storyViewer?.addEventListener("click", (event) => {
    if (event.target === storyViewer) closeStoryViewer();
  });

  document.addEventListener("keydown", (event) => {
    if (!storyViewer?.classList.contains("open")) return;
    if (event.key === "Escape") closeStoryViewer();
    if (event.key === "ArrowRight") showStoryAt(activeStoryIndex + 1);
    if (event.key === "ArrowLeft") showStoryAt(activeStoryIndex - 1);
  });

  window.addEventListener("scroll", () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 150) loadPosts();
  });

  renderHomeProfileCard();
  loadPosts();
  loadStories();
  loadNotifications();
  loadFriends();
  loadExploreUsers();
