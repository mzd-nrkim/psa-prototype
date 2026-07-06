<script lang="ts">
  import { goto } from '$app/navigation';
  import { projects, employees, grades, assignments, weeklyReports } from '$lib/data/mock';
  import { projectPnl } from '$lib/pnl';
  import { projectHealth } from '$lib/health';
  import { portfolioSummary, healthGradeCounts, utilizationSummary } from '$lib/portfolio';
  import { formatAmount, formatPercent, marginSignal } from '$lib/format';
  import { currentRole, canView, maskValue } from '$lib/permissions';
  import type { Role } from '$lib/permissions';

  // ── 상수 ──────────────────────────────────────────────────────────────────
  const CURRENT_WEEK = '2026-W27';

  // ── 정적 파생 데이터 ──────────────────────────────────────────────────────
  const summary = portfolioSummary(projects, assignments, employees, grades);
  const gradeCounts = healthGradeCounts(projects, assignments, employees, grades);
  const utilSummary = utilizationSummary(employees, assignments, grades);

  const allRows = projects.map((p) => {
    const pnl = projectPnl(p, assignments, employees, grades);
    const health = projectHealth(p, pnl);
    const projectAssignments = assignments.filter((a) => a.projectCode === p.code);
    const headcount = new Set(projectAssignments.map((a) => a.employeeId)).size;
    const totalMM = projectAssignments.reduce((s, a) => s + a.mm, 0);
    const report = weeklyReports.find(
      (r) => r.projectCode === p.code && r.week === CURRENT_WEEK,
    );
    const latestReport = weeklyReports
      .filter((r) => r.projectCode === p.code)
      .sort((a, b) => b.week.localeCompare(a.week))[0];
    return { project: p, pnl, health, headcount, totalMM, report, latestReport };
  });

  const pmOptions = [...new Set(projects.map((p) => p.pm).filter(Boolean))] as string[];
  const clientOptions = [...new Set(projects.map((p) => p.client))];

  // ── 정렬·필터·검색 ($state) ───────────────────────────────────────────────
  type SortKey = 'health' | 'marginRate' | 'progressRate' | 'contractAmount' | 'endDate';

  let sortKey = $state<SortKey>('health');
  let sortDir = $state<'asc' | 'desc'>('asc');
  let filterHealth = $state('');
  let filterLifecycle = $state('');
  let filterPM = $state('');
  let filterClient = $state('');
  let searchText = $state('');

  function healthRank(grade: string): number {
    return grade === '위험' ? 0 : grade === '주의' ? 1 : 2;
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = key === 'health' ? 'asc' : 'desc';
    }
  }

  const filteredRows = $derived.by(() => {
    let rows = allRows;
    if (filterHealth) rows = rows.filter((r) => r.health.grade === filterHealth);
    if (filterLifecycle)
      rows = rows.filter((r) => (r.project.lifecycle ?? '') === filterLifecycle);
    if (filterPM) rows = rows.filter((r) => (r.project.pm ?? '') === filterPM);
    if (filterClient) rows = rows.filter((r) => r.project.client === filterClient);
    if (searchText) {
      const q = searchText.toLowerCase();
      rows = rows.filter((r) => r.project.name.toLowerCase().includes(q));
    }
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'health') cmp = healthRank(a.health.grade) - healthRank(b.health.grade);
      else if (sortKey === 'marginRate') cmp = a.pnl.marginRate - b.pnl.marginRate;
      else if (sortKey === 'progressRate')
        cmp = (a.project.progressRate ?? 0) - (b.project.progressRate ?? 0);
      else if (sortKey === 'contractAmount') cmp = a.pnl.revenue - b.pnl.revenue;
      else if (sortKey === 'endDate')
        cmp = (a.project.endDate ?? '').localeCompare(b.project.endDate ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  });

  // ── 헬퍼 함수 ─────────────────────────────────────────────────────────────
  function healthColor(grade: string): string {
    if (grade === '정상') return 'var(--health-ok)';
    if (grade === '주의') return 'var(--health-watch)';
    return 'var(--health-risk)';
  }

  function lifecycleClass(lc?: string): string {
    if (lc === '진행') return 'chip chip--active';
    if (lc === '완료') return 'chip chip--done';
    if (lc === '중단') return 'chip chip--stopped';
    return 'chip chip--propose';
  }

  function isDelayed(p: (typeof projects)[0]): boolean {
    return !!(p.actualEndDate && p.plannedEndDate && p.actualEndDate > p.plannedEndDate);
  }

  function sortIcon(key: SortKey): string {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  // 권한 마스킹 헬퍼 (반응형: $currentRole 구독)
  function maskedMargin(rate: number): string {
    return canView('마진', $currentRole) ? formatPercent(rate) : maskValue('', false);
  }

  function maskedContract(amount: number): string {
    return canView('손익', $currentRole) ? formatAmount(amount) : maskValue('', false);
  }

  function maskedCost(amount: number): string {
    return canView('인건원가', $currentRole) ? formatAmount(amount) : maskValue('', false);
  }

  // 역할 전환
  function setRole(r: Role) {
    currentRole.set(r);
  }
</script>

<div class="page">
  <!-- ── Role 전환 토글 ── -->
  <div class="role-bar">
    <span class="role-label">권한 시연:</span>
    {#each (['admin', 'pm', 'viewer'] as Role[]) as r}
      <button
        class="role-btn"
        class:role-btn--active={$currentRole === r}
        onclick={() => setRole(r)}
      >{r}</button>
    {/each}
    <span class="role-hint">
      {#if $currentRole === 'admin'}관리자 — 전체 열람{:else if $currentRole === 'pm'}PM — 마진·손익 열람, 인당수익 제한{:else}뷰어 — 민감 지표 잠금{/if}
    </span>
  </div>

  <!-- ── 페이지 헤더 ── -->
  <div class="page-header">
    <h1 class="page-title">전사 포트폴리오 대시보드</h1>
    <span class="page-week">{CURRENT_WEEK} 기준</span>
  </div>

  <!-- ── C-1 KPI 요약 ── -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <span class="kpi-label">진행 중 프로젝트</span>
      <span class="kpi-value">{summary.activeCount}<span class="kpi-unit">건</span></span>
    </div>
    <div class="kpi-card kpi-card--risk">
      <span class="kpi-label">위험 프로젝트</span>
      <span class="kpi-value">{summary.riskCount}<span class="kpi-unit">건</span></span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">합산 수주</span>
      <span class="kpi-value tabular-nums">{maskedContract(summary.totalContract)}</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">전사 마진율</span>
      <span
        class="kpi-value tabular-nums"
        style="color: {canView('마진', $currentRole)
          ? marginSignal(summary.marginRate).color
          : 'var(--text)'};"
      >{maskedMargin(summary.marginRate)}</span>
    </div>
  </div>

  <!-- ── C-1 헬스 등급 집계 + C-5 가동 현황 ── -->
  <div class="summary-row">
    <div class="summary-card">
      <span class="summary-card__title">헬스 등급</span>
      <div class="health-chips">
        <span class="health-chip health-chip--ok">
          <span class="dot" style="background:var(--health-ok);"></span>정상 {gradeCounts.정상}
        </span>
        <span class="health-chip health-chip--watch">
          <span class="dot" style="background:var(--health-watch);"></span>주의 {gradeCounts.주의}
        </span>
        <span class="health-chip health-chip--risk">
          <span class="dot" style="background:var(--health-risk);"></span>위험 {gradeCounts.위험}
        </span>
      </div>
    </div>

    <!-- C-5 가동 현황 -->
    <div class="summary-card">
      <span class="summary-card__title">인력 가동 현황</span>
      <div class="util-row">
        <div class="util-item">
          <span class="util-value" style="color:var(--util-billable);">{utilSummary.assignedCount}</span>
          <span class="util-label">배정</span>
        </div>
        <div class="util-sep">/</div>
        <div class="util-item">
          <span class="util-value" style="color:var(--util-bench);">{utilSummary.benchCount}</span>
          <span class="util-label">벤치</span>
        </div>
        <div class="util-sep">·</div>
        <div class="util-item">
          <span class="util-value tabular-nums">{formatPercent(utilSummary.utilizationRate)}</span>
          <span class="util-label">가동률</span>
        </div>
      </div>
      <div class="util-bench-cost">
        벤치 기대비용 <span class="tabular-nums" style="color:var(--util-bench);">{maskedCost(utilSummary.expectedBenchCost)}</span>
        · 미배정률 <span class="tabular-nums">{formatPercent(utilSummary.unassignedRatio)}</span>
      </div>
    </div>

    <!-- C-6 주간보고 상태 요약 -->
    <div class="summary-card">
      <span class="summary-card__title">주간보고 현황 ({CURRENT_WEEK})</span>
      <div class="weekly-list">
        {#each allRows as { project, report, latestReport }}
          <div class="weekly-item" class:weekly-item--missing={!report}>
            <span class="weekly-code">{project.code}</span>
            {#if report}
              <span class="weekly-status weekly-status--ok">작성</span>
              <span class="weekly-detail tabular-nums">진척 {report.progressRate}%</span>
              {#if report.issues && report.issues !== '없음'}
                <span class="weekly-issue">{report.issues}</span>
              {/if}
            {:else}
              <span class="weekly-status weekly-status--missing">누락</span>
              {#if latestReport}
                <span class="weekly-detail">최근: {latestReport.week}</span>
              {:else}
                <span class="weekly-detail">보고 없음</span>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- ── C-3 필터·검색 ── -->
  <div class="filter-bar">
    <input
      class="search-input"
      type="text"
      placeholder="프로젝트명 검색"
      bind:value={searchText}
    />
    <select class="filter-select" bind:value={filterHealth}>
      <option value="">헬스 전체</option>
      <option value="정상">정상</option>
      <option value="주의">주의</option>
      <option value="위험">위험</option>
    </select>
    <select class="filter-select" bind:value={filterLifecycle}>
      <option value="">라이프사이클 전체</option>
      <option value="제안">제안</option>
      <option value="진행">진행</option>
      <option value="완료">완료</option>
      <option value="중단">중단</option>
    </select>
    <select class="filter-select" bind:value={filterPM}>
      <option value="">PM 전체</option>
      {#each pmOptions as pm}
        <option value={pm}>{pm}</option>
      {/each}
    </select>
    <select class="filter-select" bind:value={filterClient}>
      <option value="">고객사 전체</option>
      {#each clientOptions as client}
        <option value={client}>{client}</option>
      {/each}
    </select>
    {#if filterHealth || filterLifecycle || filterPM || filterClient || searchText}
      <button
        class="filter-reset"
        onclick={() => {
          filterHealth = '';
          filterLifecycle = '';
          filterPM = '';
          filterClient = '';
          searchText = '';
        }}
      >초기화</button>
    {/if}
    <span class="filter-count">{filteredRows.length} / {allRows.length}건</span>
  </div>

  <!-- ── C-2 프로젝트 목록 테이블 ── -->
  <div class="table-wrap">
    <table class="pf-table">
      <thead>
        <tr>
          <th class="col-name">프로젝트명</th>
          <th class="col-client">고객사</th>
          <th class="col-pm">PM</th>
          <th class="col-lc">상태</th>
          <th class="col-num sortable" onclick={() => toggleSort('progressRate')}>
            진척률 {sortIcon('progressRate')}
          </th>
          <th class="col-period">계획기간 ~ 실제기간</th>
          <th class="col-num">투입</th>
          <th class="col-num">M/M</th>
          <th class="col-num sortable" onclick={() => toggleSort('contractAmount')}>
            수주 {sortIcon('contractAmount')}
          </th>
          <th class="col-num sortable" onclick={() => toggleSort('marginRate')}>
            마진율 {sortIcon('marginRate')}
          </th>
          <th class="col-health sortable" onclick={() => toggleSort('health')}>
            헬스 {sortIcon('health')}
          </th>
          <th class="col-weekly">주간보고</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredRows as { project: p, pnl, health, headcount, totalMM, report }}
          {@const delayed = isDelayed(p)}
          {@const isStopped = p.lifecycle === '중단'}
          <tr
            class="data-row"
            class:data-row--stopped={isStopped}
            onclick={() => goto(`/project/${p.code}`)}
          >
            <!-- 프로젝트명 -->
            <td class="col-name">
              <a
                class="row-link"
                href="/project/{p.code}"
                onclick={(e) => e.stopPropagation()}
              >{p.name}</a>
            </td>

            <!-- 고객사 -->
            <td class="col-client">{p.client}</td>

            <!-- PM -->
            <td class="col-pm">{p.pm ?? '—'}</td>

            <!-- lifecycle 칩 -->
            <td class="col-lc">
              <span class={lifecycleClass(p.lifecycle)}>{p.lifecycle ?? '—'}</span>
            </td>

            <!-- 진척률 -->
            <td class="col-num tabular-nums">
              {#if p.progressRate !== undefined}
                <div class="progress-wrap">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      style="width:{p.progressRate}%; background:{health.grade === '위험'
                        ? 'var(--health-risk)'
                        : health.grade === '주의'
                          ? 'var(--health-watch)'
                          : 'var(--health-ok)'};"
                    ></div>
                  </div>
                  <span class="progress-label">{p.progressRate}%</span>
                </div>
              {:else}
                <span class="text-muted">—</span>
              {/if}
            </td>

            <!-- 계획기간 ~ 실제기간 -->
            <td class="col-period">
              <span class="period-planned">{p.plannedEndDate ?? p.endDate}</span>
              {#if p.actualEndDate}
                <span class="period-sep">→</span>
                <span class="period-actual" class:period-actual--over={delayed}>
                  {p.actualEndDate}
                  {#if delayed}<span class="delay-tag">초과</span>{/if}
                </span>
              {/if}
            </td>

            <!-- 투입인원 -->
            <td class="col-num tabular-nums">{headcount}명</td>

            <!-- 누적 M/M -->
            <td class="col-num tabular-nums">{totalMM.toFixed(1)}</td>

            <!-- 수주 -->
            <td class="col-num tabular-nums">{maskedContract(pnl.revenue)}</td>

            <!-- 마진율 -->
            <td
              class="col-num tabular-nums"
              style="color:{canView('마진', $currentRole)
                ? marginSignal(pnl.marginRate).color
                : 'var(--text)'}; font-weight:500;"
            >{maskedMargin(pnl.marginRate)}</td>

            <!-- 헬스 신호등 + reasons -->
            <td class="col-health">
              <div class="health-cell">
                <span class="health-dot" style="background:{healthColor(health.grade)};"></span>
                <span class="health-grade" style="color:{healthColor(health.grade)};"
                  >{health.grade}</span>
                <div class="reason-tags">
                  {#each health.reasons as reason}
                    <span class="reason-tag reason-tag--{reason === '적자'
                      ? 'risk'
                      : reason === '저마진'
                        ? 'watch'
                        : 'delay'}">{reason}</span>
                  {/each}
                </div>
              </div>
            </td>

            <!-- 주간보고 -->
            <td class="col-weekly">
              {#if report}
                <span class="report-ok">작성</span>
              {:else}
                <span class="report-missing">누락</span>
              {/if}
            </td>
          </tr>
        {/each}

        {#if filteredRows.length === 0}
          <tr>
            <td colspan="12" class="empty-row">조건에 맞는 프로젝트가 없습니다.</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<style>
  /* ── 레이아웃 ── */
  .page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Role 전환 ── */
  .role-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
  }

  .role-label {
    color: var(--text-secondary);
    margin-right: 4px;
  }

  .role-btn {
    padding: 3px 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.1s, color 0.1s;
  }

  .role-btn:hover {
    background: var(--surface-muted);
    color: var(--text);
  }

  .role-btn--active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    font-weight: 500;
  }

  .role-hint {
    margin-left: 8px;
    color: var(--text-secondary);
  }

  /* ── 페이지 헤더 ── */
  .page-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--ink);
    line-height: 28px;
  }

  .page-week {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  /* ── KPI 카드 ── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .kpi-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }

  .kpi-card--risk {
    border-left: 3px solid var(--health-risk);
  }

  .kpi-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .kpi-value {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--ink);
    line-height: 28px;
  }

  .kpi-unit {
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--text-secondary);
    margin-left: 2px;
  }

  /* ── 요약 행 (헬스·가동·주간보고) ── */
  .summary-row {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1.6fr;
    gap: 12px;
  }

  .summary-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }

  .summary-card__title {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* 헬스 칩 */
  .health-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .health-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    font-weight: 500;
    background: var(--surface-muted);
    border: 1px solid var(--border);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .health-chip--ok { color: var(--health-ok); }
  .health-chip--watch { color: var(--health-watch); }
  .health-chip--risk { color: var(--health-risk); }

  /* 가동 현황 */
  .util-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .util-item {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .util-value {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink);
  }

  .util-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .util-sep {
    color: var(--border-strong);
    font-size: var(--text-sm);
  }

  .util-bench-cost {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  /* 주간보고 */
  .weekly-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .weekly-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-xs);
    padding: 3px 6px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
  }

  .weekly-item--missing {
    border: 1px dashed var(--status-missing);
    background: var(--surface-muted);
  }

  .weekly-code {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: var(--text-xs);
    color: var(--text-secondary);
    min-width: 44px;
  }

  .weekly-status--ok {
    color: var(--health-ok);
    font-weight: 500;
  }

  .weekly-status--missing {
    color: var(--status-missing);
    font-weight: 500;
  }

  .weekly-detail {
    color: var(--text-secondary);
  }

  .weekly-issue {
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
    font-style: italic;
  }

  /* ── 필터 바 ── */
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .search-input {
    padding: 5px 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--text);
    background: var(--surface);
    font-family: inherit;
    min-width: 160px;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(14, 116, 144, 0.15);
  }

  .filter-select {
    padding: 5px 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--text);
    background: var(--surface);
    font-family: inherit;
    outline: none;
    cursor: pointer;
  }

  .filter-select:focus {
    border-color: var(--accent);
  }

  .filter-reset {
    padding: 5px 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    background: var(--surface);
    font-family: inherit;
    cursor: pointer;
  }

  .filter-reset:hover {
    background: var(--surface-muted);
    color: var(--text);
  }

  .filter-count {
    margin-left: auto;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  /* ── 테이블 ── */
  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  .pf-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .pf-table thead tr {
    background: var(--surface-muted);
    border-bottom: 1px solid var(--border-strong);
  }

  .pf-table th {
    padding: 8px 10px;
    font-weight: 500;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-align: left;
  }

  .pf-table th.col-num {
    text-align: right;
  }

  .pf-table th.col-health {
    text-align: left;
  }

  .pf-table th.sortable {
    cursor: pointer;
    user-select: none;
  }

  .pf-table th.sortable:hover {
    color: var(--text);
    background: var(--surface-muted);
  }

  .data-row {
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background-color 0.1s;
  }

  .data-row:hover {
    background-color: var(--accent-weak);
  }

  .data-row:last-child {
    border-bottom: none;
  }

  /* C-4 중단 행 — 점선 테두리 구분 */
  .data-row--stopped {
    border-bottom: 1px dashed var(--health-risk);
    opacity: 0.75;
  }

  .data-row--stopped td {
    color: var(--text-secondary);
  }

  .pf-table td {
    padding: 8px 10px;
    color: var(--text);
    white-space: nowrap;
    vertical-align: middle;
  }

  .col-name { min-width: 140px; }
  .col-client { color: var(--text-secondary); }
  .col-pm { color: var(--text-secondary); min-width: 60px; }
  .col-lc { min-width: 64px; }
  .col-num { text-align: right; min-width: 72px; }
  .col-period { min-width: 180px; font-size: var(--text-xs); }
  .col-health { min-width: 120px; }
  .col-weekly { text-align: center; min-width: 56px; }

  /* 링크 */
  .row-link {
    color: var(--accent);
    text-decoration: none;
    font-weight: 500;
  }

  .row-link:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  /* lifecycle 칩 */
  .chip {
    display: inline-block;
    padding: 2px 7px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
    border: 1px solid transparent;
  }

  .chip--active {
    color: var(--accent);
    background: var(--accent-weak);
    border-color: var(--accent);
  }

  .chip--propose {
    color: var(--text-secondary);
    background: var(--surface-muted);
    border-color: var(--border);
  }

  .chip--done {
    color: var(--text-secondary);
    background: var(--surface-muted);
    border-color: var(--border);
  }

  .chip--stopped {
    color: var(--health-risk);
    background: transparent;
    border: 1px dashed var(--health-risk);
  }

  /* 진척률 바 */
  .progress-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
  }

  .progress-bar {
    width: 48px;
    height: 4px;
    background: var(--surface-muted);
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.2s;
  }

  .progress-label {
    min-width: 32px;
    text-align: right;
  }

  /* 기간 컬럼 */
  .period-planned {
    color: var(--text-secondary);
  }

  .period-sep {
    color: var(--border-strong);
    margin: 0 4px;
  }

  .period-actual {
    color: var(--text);
  }

  .period-actual--over {
    color: var(--health-watch);
  }

  .delay-tag {
    display: inline-block;
    margin-left: 4px;
    padding: 1px 4px;
    border-radius: 2px;
    font-size: 10px;
    font-weight: 500;
    color: var(--health-watch);
    background: #FEF3C7;
    border: 1px solid var(--health-watch);
  }

  /* 헬스 셀 */
  .health-cell {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-wrap: wrap;
  }

  .health-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .health-grade {
    font-size: var(--text-xs);
    font-weight: 500;
    min-width: 24px;
  }

  .reason-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .reason-tag {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 2px;
    font-size: 10px;
    font-weight: 500;
  }

  .reason-tag--risk {
    color: var(--health-risk);
    background: #FEE2E2;
    border: 1px solid #FCA5A5;
  }

  .reason-tag--watch {
    color: #B45309;
    background: #FEF3C7;
    border: 1px solid #FCD34D;
  }

  .reason-tag--delay {
    color: #B45309;
    background: #FEF3C7;
    border: 1px solid #FCD34D;
  }

  /* 주간보고 셀 */
  .report-ok {
    display: inline-block;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--health-ok);
    background: #DCFCE7;
    border: 1px solid #86EFAC;
  }

  .report-missing {
    display: inline-block;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--status-missing);
    background: var(--surface-muted);
    border: 1px dashed var(--status-missing);
  }

  /* 빈 행 */
  .empty-row {
    text-align: center;
    padding: 32px;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .text-muted {
    color: var(--text-secondary);
  }
</style>
