import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./assets/css/style.css";
import "./assets/css/comfortaa-fonts.css";
import "unfonts.css";

type ThemeMode = "system" | "light" | "dark";
const readThemeMode = (): ThemeMode => {
  try {
    const saved = localStorage.getItem("lolia.theme");
    if (saved === "system" || saved === "light" || saved === "dark") return saved;
    if (saved === "lightTheme") return "light";
    if (saved === "darkTheme") return "dark";
  } catch {
    // Ignore unavailable storage.
  }
  return "system";
};

const applyTheme = () => {
  const mode = readThemeMode();
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.setAttribute("theme-mode", dark ? "dark" : "light");
};

applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
window.addEventListener("lolia-theme-change", applyTheme);

const pinia = createPinia();

createApp(App).use(pinia).use(router).mount("#app");
