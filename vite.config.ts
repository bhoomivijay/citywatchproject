import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const groqKey = env.VITE_GROQ_API_KEY;

  return {
    server: {
      host: "::",
      port: 8080,
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      },
      proxy: groqKey
        ? {
            "/api/groq": {
              target: "https://api.groq.com/openai/v1",
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/groq/, ""),
              headers: {
                Authorization: `Bearer ${groqKey}`,
              },
            },
          }
        : undefined,
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
