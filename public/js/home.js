requireAuth();
const postForm = document.getElementById("postForm");
const postImage = document.getElementById("postImage");
const imagePreview = document.getElementById("imagePreview");
const feed = document.getElementById("feed");
const notificationsList = document.getElementById("notifications");

let page = 1;
let hasMore = true;
let isLoading = false;

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
      <button onclick="react('${post._id}','like')">Like (${post.likes.length})</button>
      <button onclick="react('${post._id}','dislike')">Dislike (${post.dislikes.length})</button>
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

async function react(postId, action) {
  await apiFetch(`/posts/${postId}/react`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
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

async function loadNotifications() {
  const notifications = await apiFetch("/notifications");
  notificationsList.innerHTML = notifications
    .slice(0, 6)
    .map((n) => `<div class="notification-item">${n.actorId.username} ${n.type}d your post</div>`)
    .join("");
}

window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 150) loadPosts();
});

loadPosts();
loadNotifications();
