requireAuth();
const profileForm = document.getElementById("profileForm");
const profilePic = document.getElementById("profilePic");
const profilePreview = document.getElementById("profilePreview");
const profileCard = document.getElementById("profileCard");
const userSearch = document.getElementById("userSearch");
const searchResults = document.getElementById("searchResults");

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
  const user = await apiFetch("/users/me");
  profileCard.innerHTML = `
    <div class="row">
      <img class="avatar" src="${user.profilePic}" alt="profile" />
      <div>
        <h3>${user.username}</h3>
        <p>${user.bio || "No bio yet"}</p>
        <p class="muted">${user.followers.length} followers • ${user.following.length} following</p>
      </div>
    </div>
  `;
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
  const users = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
  searchResults.innerHTML = users
    .map(
      (u) => `
      <div class="card user-result">
        <div class="row between">
          <div class="row">
            <img class="avatar" src="${u.profilePic}" />
            <div><strong>${u.username}</strong><div class="muted">${u.bio || ""}</div></div>
          </div>
          <button onclick="toggleFollow('${u._id}')">Follow / Unfollow</button>
        </div>
      </div>`
    )
    .join("");
});

async function toggleFollow(userId) {
  const res = await apiFetch(`/users/follow/${userId}`, { method: "POST" });
  alert(res.message);
  loadProfile();
}

loadProfile();
