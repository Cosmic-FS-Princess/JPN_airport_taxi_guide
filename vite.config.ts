import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Four static pages are published together: the airport chooser and the three
// guides. Relative asset paths (base: "./") keep the same build working at a
// custom domain root and under the default github.io project subpath.
// Keep the dev server from watching transient files (editor temp dirs, the
// headless-browser profile) that can be locked on Windows and crash the watcher.
export default defineConfig({
  base: "./",
  appType: "mpa",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        chooser: fileURLToPath(new URL("./index.html", import.meta.url)),
        haneda: fileURLToPath(new URL("./haneda/index.html", import.meta.url)),
        narita: fileURLToPath(new URL("./narita/index.html", import.meta.url)),
        rjoo: fileURLToPath(new URL("./rjoo/index.html", import.meta.url)),
      },
    },
  },
  server: {
    watch: {
      ignored: ["**/.edgeprofile/**", "**/*.tmpdir/**", "**/.*.tmp*"],
    },
  },
});
