const themeBtn = document.getElementById("themeBtn");
const applyTheme = () => {
  const theme = localStorage.getItem("theme") || "dark";
  document.body.classList.toggle("light", theme === "light");
};
applyTheme();
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = (localStorage.getItem("theme") || "dark") === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme();
  });
}
