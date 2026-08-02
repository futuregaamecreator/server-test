import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    tailwindcss(), // ✅ important for Tailwind v4
    react()
  ],
  base: "/public/widget/",
  build: {
    outDir: resolve(__dirname, "../public/widget"),
    emptyOutDir: true
  }
});
