import { defineConfig } from 'vite';

// Vite builds only index.html unless told otherwise. Each page is a real HTML
// file, so the policies read without JavaScript and can be crawled by the
// stores' reviewers; vercel.json's cleanUrls drops the .html from their
// addresses.
export default defineConfig({
  build: {
    rollupOptions: {
      input: ['index.html', 'privacy.html', 'terms.html', 'support.html', 'delete-account.html'],
    },
  },
});
