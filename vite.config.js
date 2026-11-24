import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the browser only talks to Vite (port 5173); Vite forwards /api to the API
// server. One single address means the session cookie can stay SameSite=Strict, and no CORS is needed.
const API_PORT = process.env.PORT || 4000;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://localhost:" + API_PORT, changeOrigin: false } },
  },
});
