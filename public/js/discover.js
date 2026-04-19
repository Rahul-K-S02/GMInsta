requireAuth();
const discoverList = document.getElementById("discoverList");
const socket = io("/", { auth: { token: getToken() } });

socket.on("connect", () => {
  console.log("Discover socket connected");
});

socket.on("disconnect", () => {
  console.log("Discover socket disconnected");
});

socket.on("follow_update", () => {
  loadDiscoverUsers();
});

async function loadDiscoverUsers() {
  try {
    discoverList.innerHTML = '<p class="muted" style="padding:10px;">Loading discover users...</p>';
    const allUsers = await apiFetch("/users/discover?limit=50");

    const cards = allUsers.map((u) => {
        const isFollowing = u.isFollowing;
        const isFollower = u.isFollower;
        const relationLabel = isFollowing ? "Following" : isFollower ? "Follower" : "Suggested";
        const canMessage = isFollowing || isFollower;
        const mutualLabel = u.mutualFriendsCount > 0 ? `${u.mutualFriendsCount} mutual friend${u.mutualFriendsCount === 1 ? '' : 's'}` : '';

        return `
          <div class="user-item" id="discover-${u._id}">
            <img class="avatar" src="${u.profilePic}" alt="${u.username}" />
            <div class="user-info">
              <strong onclick="viewUserProfile('${u._id}')" style="cursor:pointer;">${u.username}</strong>
              <p class="muted" style="font-size:12px; margin:4px 0;">${u.bio || 'No bio'}</p>
              <p class="muted" style="font-size:12px;">${relationLabel}${mutualLabel ? ` • ${mutualLabel}` : ""} • ${u.followersCount || 0} followers • ${u.followingCount || 0} following</p>
              <div class="user-actions">
                <a href="#" class="btn-small follow-btn" data-action="toggle-follow" data-user-id="${u._id}">${isFollowing ? 'Unfollow' : 'Follow'}</a>
                ${canMessage ? `<button class="btn-small msg-btn" onclick="messageFriend('${u._id}', '${u.username}')">Message</button>` : ''}
              </div>
            </div>
          </div>
        `;
      });

    discoverList.innerHTML = cards.length > 0
      ? cards.join("")
      : '<p class="muted" style="padding:10px;">No other users found to discover.</p>';
  } catch (error) {
    console.error("Error loading discover users:", error);
    discoverList.innerHTML = '<p class="muted" style="padding:10px;">Error loading users: ' + error.message + '</p>';
  }
}

async function toggleFollow(userId, element) {
  try {
    const isFollowing = element.textContent.trim() === 'Unfollow';
    element.textContent = isFollowing ? 'Unfollowing...' : 'Following...';

    await apiFetch(`/users/follow/${userId}`, { method: 'POST' });
    await loadDiscoverUsers();
  } catch (error) {
    element.textContent = element.textContent.replace('Following...', 'Follow').replace('Unfollowing...', 'Unfollow');
    console.error("Error toggling follow:", error);
    alert("Error: " + error.message);
  }
}

discoverList.addEventListener('click', async (event) => {
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

loadDiscoverUsers();
window.toggleFollow = toggleFollow;
window.messageFriend = messageFriend;
window.viewUserProfile = viewUserProfile;
