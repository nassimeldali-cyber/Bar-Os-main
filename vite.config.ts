
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Render injects RENDER_EXTERNAL_HOSTNAME for the live service. Allow it (plus
// any custom domain(s) via PREVIEW_EXTRA_HOSTS) so `vite preview` accepts the
// request host during a Render deployment.
const previewAllowedHosts = ['bar-os-main.onrender.com', 'localhost', '127.0.0.1'];
if (process.env.RENDER_EXTERNAL_HOSTNAME) {
  previewAllowedHosts.push(process.env.RENDER_EXTERNAL_HOSTNAME);
}
if (process.env.PREVIEW_EXTRA_HOSTS) {
  previewAllowedHosts.push(...process.env.PREVIEW_EXTRA_HOSTS.split(',').map((h) => h.trim()).filter(Boolean));
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: true,
      allowedHosts: previewAllowedHosts,
    },
  };
});
