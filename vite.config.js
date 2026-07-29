import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves project sites from /<repository-name>/.
  base: process.env.GITHUB_ACTIONS ? '/chess/' : '/',
});
