import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/postcss"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    // Tailwind 走 PostCSS：样式入口是 .scss，@tailwindcss/vite 只处理 .css 入口会漏编译
    plugins: [react()],
    css: {
      postcss: { plugins: [tailwindcss()] },
    },
    resolve: {
      alias: {
        "@": resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      port: Number(process.env.VITE_PORT) || 5173,
    },
  }
})
