requireAuth();
const reelsFeed = document.getElementById("reelsFeed");
const socket = io("/", { auth: { token: getToken() } });

let page = 1;
let hasMore = true;
let isLoading = false;
const expandedComments = new Set();

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  clearAuth();
  window.location.href = "/";
});

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

const renderReel = (post) => {
  const videoUrl = post.mediaUrl || "";
  return `
    <article class="card post-card">
      <div class="row post-head">
        <img class="avatar" src="${post.userId?.profilePic || "/public/images/default-avatar.svg"}" alt="avatar" />
        <div>
          <strong>${escapeHtml(post.userId?.username || "Unknown")}</strong>
          <div class="muted">${new Date(post.createdAt).toLocaleString()}</div>
        </div>
      </div>
      <p>${escapeHtml(post.caption)}</p>
      <video class="post-video" src="${videoUrl}" controls playsinline preload="metadata"></video>
      <div class="row post-actions">
        <button type="button" class="btn-small ${post.isLiked ? "liked" : ""}" data-action="post-react" data-post-id="${post._id}" data-react="like">
          ${post.isLiked ? "Unlike" : "Like"} (${post.likesCount ?? 0})
        </button>
        <button type="button" class="btn-small ${post.isDisliked ? "disliked" : ""}" data-action="post-react" data-post-id="${post._id}" data-react="dislike">
          ${post.isDisliked ? "Undislike" : "Dislike"} (${post.dislikesCount ?? 0})
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
};

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
    const data = await apiFetch(`/comments/${postId}?sort=asc`);

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

async function loadReels() {
  if (!hasMore || isLoading) return;
  isLoading = true;
  try {
    const data = await apiFetch(`/posts/reels?page=${page}&limit=6`);
    const reels = Array.isArray(data.reels) ? data.reels : [];

    if (page === 1 && reels.length === 0) {
      reelsFeed.innerHTML = `
        <div class="card empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.2"/></svg>
          </div>
          <h3>No Reels Yet</h3>
          <p>Upload a video to start the reels feed.</p>
          <a class="header-chip" href="/create" style="text-decoration:none; display:inline-block;">Create Reel</a>
        </div>
      `;
      hasMore = false;
      return;
    }

    reels.forEach((post) => {
      reelsFeed.insertAdjacentHTML("beforeend", renderReel(post));
      loadComments(post._id);
    });

    hasMore = page < (data.totalPages || 1);
    page += 1;
  } catch (error) {
    console.error(error.message);
  } finally {
    isLoading = false;
  }
}

async function react(postId, action) {
  try {
    await apiFetch(`/posts/${postId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    reelsFeed.innerHTML = "";
    page = 1;
    hasMore = true;
    await loadReels();
  } catch (error) {
    alert(error.message);
  }
}

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
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 150) loadReels();
});

socket.on("connect", () => console.log("Reels socket connected"));
socket.on("disconnect", () => console.log("Reels socket disconnected"));

loadReels();
