// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";
import type { VitePWAOptions } from "vite-plugin-pwa";

// vite-plugin-pwa membaca `viteConfig.build.outDir` (root-level = "dist"), bukan
// output environment client. Plugin kecil di bawah menyalin resolved client outDir
// (sandbox -> dist/client, Cloudflare/Nitro -> .output/public) ke opsi PWA sebelum
// hook configResolved milik VitePWA berjalan, sehingga sw.js selalu mendarat di
// direktori aset yang benar-benar dideploy.
const pwaOptions: Partial<VitePWAOptions> = {
  strategies: "generateSW",
  // Generate the PWA artifacts before Nitro snapshots the client output for
  // Cloudflare Workers static-asset deployment.
  integration: { closeBundleOrder: "pre" },
  registerType: "autoUpdate",
  injectRegister: null,
  filename: "sw.js",
  manifest: false,
  manifestFilename: "manifest.webmanifest",
  devOptions: { enabled: false },
  workbox: {
    globPatterns: ["**/*.{js,css,ico,png,svg,webp,woff2}"],
    // Handler Web Push (bukan cache app-shell) disisipkan ke service worker generated.
    importScripts: ["/push-sw.js"],
    navigateFallback: "/",
    navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn\//],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    runtimeCaching: [
      {
        urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "html-navigations",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      {
        urlPattern: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
          sameOrigin && ["style", "script", "worker", "font"].includes(request.destination),
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
          sameOrigin && request.destination === "image",
        handler: "CacheFirst",
        options: {
          cacheName: "images",
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
};

const pwaOutDirFollowsClientEnv: Plugin = {
  name: "lpk-pwa-outdir-follow-client-env",
  enforce: "pre",
  apply: "build",
  configResolved(config) {
    const clientOutDir = config.environments?.["client"]?.build?.outDir;
    if (clientOutDir) pwaOptions.outDir = clientOutDir;
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [pwaOutDirFollowsClientEnv, VitePWA(pwaOptions)],
  },
});
