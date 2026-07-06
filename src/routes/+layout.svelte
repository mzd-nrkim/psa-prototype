<script lang="ts">
  import type { Snippet } from 'svelte';
  import { base } from '$app/paths';
  import { page } from '$app/state';

  let { children }: { children: Snippet } = $props();

  // 전역 네비게이션 — 최상위 라우트를 여기 한 줄로 추가하면 자동 연결된다.
  const navItems = [
    { href: '/', label: '대시보드' },
    { href: '/people', label: '임직원 현황' },
  ];

  // base를 제외한 현재 경로. 활성 항목 판정에 사용.
  const currentPath = $derived(page.url.pathname.slice(base.length) || '/');

  function isActive(href: string): boolean {
    if (href === '/') return currentPath === '/';
    return currentPath === href || currentPath.startsWith(href + '/');
  }
</script>

<header class="app-header">
  <span class="app-header__title">PSA — 프로젝트 경제성 레이어</span>
  <nav class="app-nav">
    {#each navItems as item (item.href)}
      <a
        class="app-nav__link"
        class:app-nav__link--active={isActive(item.href)}
        href="{base}{item.href}"
        aria-current={isActive(item.href) ? 'page' : undefined}
      >
        {item.label}
      </a>
    {/each}
  </nav>
</header>

<main class="app-content">
  {@render children()}
</main>

<style>
  /* =========================================================
     CSS 토큰 — DESIGN.md 기준
     ========================================================= */
  :root {
    /* 뉴트럴 (슬레이트 계열) */
    --bg:             #F8FAFC;
    --surface:        #FFFFFF;
    --surface-muted:  #F1F5F9;
    --border:         #E2E8F0;
    --border-strong:  #CBD5E1;
    --text:           #1E293B;
    --text-secondary: #64748B;
    --ink:            #0F172A;

    /* 액센트 (틸) */
    --accent:         #0E7490;
    --accent-hover:   #0C5E74;
    --accent-weak:    #ECFEFF;

    /* 기능 상태색 — PSA 신호등 */
    --health-ok:      #16A34A;
    --health-watch:   #D97706;
    --health-risk:    #DC2626;

    /* 가동률 */
    --util-billable:  #16A34A;
    --util-bench:     #94A3B8;

    /* 데이터 상태 */
    --status-missing: #CBD5E1;

    /* 타이포그래피 스케일 */
    --text-xs:   12px;
    --text-sm:   13px;
    --text-base: 14px;
    --text-lg:   16px;
    --text-xl:   20px;

    /* radius */
    --radius-sm: 4px;
    --radius-md: 6px;
  }

  /* =========================================================
     기본 리셋 & body
     ========================================================= */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    background-color: var(--bg);
    color: var(--text);
    font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif;
    font-size: var(--text-base);
    line-height: 20px;
    -webkit-font-smoothing: antialiased;
  }

  /* tabular-nums 유틸 — 숫자 표·금액 열에 적용 */
  :global(.tabular-nums) {
    font-variant-numeric: tabular-nums;
  }

  /* =========================================================
     앱 헤더
     ========================================================= */
  .app-header {
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 24px;
    background-color: var(--surface);
    border-bottom: 1px solid var(--border);
  }

  .app-header__title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--ink);
    letter-spacing: -0.01em;
  }

  .app-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 24px;
  }

  .app-nav__link {
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.12s, background-color 0.12s;
  }

  .app-nav__link:hover {
    color: var(--text);
    background-color: var(--surface-muted);
  }

  .app-nav__link--active {
    color: var(--accent);
    background-color: var(--accent-weak);
  }

  /* =========================================================
     본문 컨테이너
     ========================================================= */
  .app-content {
    padding: 24px;
  }
</style>
