import { fileURLToPath } from "node:url";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
