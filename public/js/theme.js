const themeBtn = document.getElementById("themeBtn");
const applyTheme = () => {
  const theme = localStorage.getItem("theme") || "light";
  document.body.classList.toggle("light", theme === "light");
};
applyTheme();
if (themeBtn) {
  themeBtn.addEventListener("click", () => {
    const next = (localStorage.getItem("theme") || "light") === "light" ? "dark" : "light";
    localStorage.setItem("theme", next);
    applyTheme();
  });
}
