(function () {
  const result = document.getElementById("google-auth-result");

  if (!result) {
    return;
  }

  try {
    const token = decodeURIComponent(result.dataset.token || "");
    const userJson = decodeURIComponent(result.dataset.user || "%7B%7D");
    const returnTo = decodeURIComponent(result.dataset.returnTo || "%2Fhome");
    const user = JSON.parse(userJson);
    const normalizedUser = {
      ...user,
      id: user.id || user._id || "",
      username: user.username || "",
      email: user.email || "",
      bio: user.bio || "",
      profilePic: user.profilePic || "/public/images/default-avatar.svg",
      authProvider: user.authProvider || "google",
      emailVerified: Boolean(user.emailVerified)
    };

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    if (typeof window.refreshHeaderAvatar === "function") {
      window.refreshHeaderAvatar();
    }
    window.location.replace(returnTo);
  } catch (error) {
    document.body.innerHTML = '<div class="card"><h1>Sign-in failed</h1><p class="muted">Please try again.</p></div>';
  }
})();
