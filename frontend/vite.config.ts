import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import ViteFonts from "unplugin-fonts/vite";
import Icons from "unplugin-icons/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  plugins: [
    vue(),
    Icons({ compiler: "vue3" }),
    ViteFonts({
      fontsource: {
        families: [
          {
            name: "Roboto",
            weights: [100, 300, 400, 500, 700, 900],
            styles: ["normal", "italic"],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
