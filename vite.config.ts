import { defineConfig, type Plugin } from 'vite';

// vercel.json's rewrites, for `npm run dev` and `npm run preview`: Vercel
// sends /era/* and /u/* to open.html, and Vite on its own would serve the
// waitlist there.
const sharedLinks: Plugin = {
  name: 'shared-links',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/(era|u)\/[^/]+\/?(\?|$)/.test(req.url)) req.url = '/open.html';
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/(era|u)\/[^/]+\/?(\?|$)/.test(req.url)) req.url = '/open.html';
      next();
    });
  },
};

// Vite builds only index.html unless told otherwise. Each page is a real HTML
// file, so the policies read without JavaScript and can be crawled by the
// stores' reviewers; vercel.json's cleanUrls drops the .html from their
// addresses. open.html is the page shared app links land on, rewritten to
// from /era/* and /u/* there too.
export default defineConfig({
  plugins: [sharedLinks],
  build: {
    rollupOptions: {
      input: ['index.html', 'privacy.html', 'terms.html', 'support.html', 'delete-account.html', 'open.html'],
    },
  },
});
