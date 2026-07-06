import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: '200.html'
    }),
    // GitHub Pages 프로젝트 사이트는 /<repo>/ 하위 경로로 서빙된다.
    // CI(deploy.yml)에서 BASE_PATH=/<repo> 주입, 로컬 빌드는 '' (루트).
    paths: {
      base: process.env.BASE_PATH || ''
    }
  }
};

export default config;
