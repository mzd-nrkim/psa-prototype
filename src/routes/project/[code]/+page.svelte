<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { projects, employees, grades, gradeRates } from '$lib/data/mock';
  import {
    assignments,
    addAssignment,
    updateAssignment,
    removeAssignment,
    resetAssignments,
  } from '$lib/stores/assignments';
  import { weeklyReports, addWeeklyReport } from '$lib/stores/weeklyReports';
  import { projectPnl, assignmentCostAtTime, costShare } from '$lib/pnl';
  import { perHeadContribution } from '$lib/perhead';
  import { currentRole, canView, maskValue } from '$lib/permissions';
  import { formatAmount, formatPercent, marginSignal } from '$lib/format';
  import type { Assignment } from '$lib/types';

  const CURRENT_WEEK = '2026-W27';

  // ─── 프로젝트 ──────────────────────────────────────────────────────────────
  const code = $derived($page.params.code ?? '');
  const project = $derived(projects.find((p) => p.code === code));

  // ─── 손익 (store 반응형) ────────────────────────────────────────────────────
  const pnl = $derived(
    project ? projectPnl(project, $assignments, employees, grades) : null,
  );
  const signal = $derived(pnl ? marginSignal(pnl.marginRate) : null);

  // ─── Lookup maps ───────────────────────────────────────────────────────────
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const gradeMap = new Map(grades.map((g) => [g.id, g]));

  // ─── D-3 배정 드릴다운 ─────────────────────────────────────────────────────
  type SortKey = 'startDate' | 'cost' | 'grade';
  let sortKey = $state<SortKey>('startDate');
  let sortAsc = $state(true);

  const projectAssignmentRows = $derived(
    $assignments
      .map((a, globalIdx) => {
        const emp = employeeMap.get(a.employeeId);
        const effectiveGradeId = a.assignedGradeId ?? emp?.gradeId;
        const effectiveGrade = effectiveGradeId ? gradeMap.get(effectiveGradeId) : undefined;
        const cost = assignmentCostAtTime(a, employees, grades, gradeRates);
        return { a, globalIdx, emp, effectiveGrade, cost };
      })
      .filter((r) => r.a.projectCode === code),
  );

  const totalCost = $derived(
    projectAssignmentRows.reduce((s, r) => s + r.cost, 0),
  );

  const totalMm = $derived(
    projectAssignmentRows.reduce((s, r) => s + r.a.mm, 0),
  );

  const sortedRows = $derived(
    [...projectAssignmentRows].sort((x, y) => {
      let cmp = 0;
      if (sortKey === 'startDate') {
        cmp = (x.a.startDate ?? '').localeCompare(y.a.startDate ?? '');
      } else if (sortKey === 'cost') {
        cmp = x.cost - y.cost;
      } else {
        cmp = (x.effectiveGrade?.name ?? '').localeCompare(y.effectiveGrade?.name ?? '');
      }
      return sortAsc ? cmp : -cmp;
    }),
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
  }

  // ─── D-4 배정 편집 ─────────────────────────────────────────────────────────
  const canEdit = $derived($currentRole === 'admin' || $currentRole === 'pm');

  let showAssignForm = $state(false);
  let editingGlobalIdx = $state<number | null>(null);
  let formEmployeeId = $state('');
  let formMm = $state(1);
  let formStartDate = $state('');
  let formAssignedGradeId = $state('');

  function openAddForm() {
    editingGlobalIdx = null;
    formEmployeeId = '';
    formMm = 1;
    formStartDate = '';
    formAssignedGradeId = '';
    showAssignForm = true;
  }

  function openEditForm(globalIdx: number, a: Assignment) {
    editingGlobalIdx = globalIdx;
    formEmployeeId = a.employeeId;
    formMm = a.mm;
    formStartDate = a.startDate ?? '';
    formAssignedGradeId = a.assignedGradeId ?? '';
    showAssignForm = true;
  }

  function closeAssignForm() {
    showAssignForm = false;
    editingGlobalIdx = null;
  }

  function submitAssignForm() {
    if (!formEmployeeId || formMm <= 0) return;
    const entry: Assignment = {
      projectCode: code,
      employeeId: formEmployeeId,
      mm: formMm,
      ...(formStartDate ? { startDate: formStartDate } : {}),
      ...(formAssignedGradeId ? { assignedGradeId: formAssignedGradeId } : {}),
    };
    if (editingGlobalIdx !== null) {
      updateAssignment(editingGlobalIdx, entry);
    } else {
      addAssignment(entry);
    }
    closeAssignForm();
  }

  // ─── D-6 인당 수익 ─────────────────────────────────────────────────────────
  const perHeadRows = $derived(
    projectAssignmentRows
      .filter((r) => r.emp != null)
      .map((r) => {
        const ph = perHeadContribution(r.emp!, $assignments, employees, grades, projects);
        return { emp: r.emp!, grade: r.effectiveGrade, value: ph.value, formula: ph.formula };
      }),
  );

  // ─── D-5 주간 보고 ─────────────────────────────────────────────────────────
  const filteredReports = $derived(
    [...$weeklyReports]
      .filter((r) => r.projectCode === code)
      .sort((a, b) => a.week.localeCompare(b.week)),
  );

  const hasCurrentWeekReport = $derived(
    filteredReports.some((r) => r.week === CURRENT_WEEK),
  );

  let showReportForm = $state(false);
  let reportProgress = $state(0);
  let reportIssues = $state('');
  let reportNextPlan = $state('');

  function submitReport() {
    if (!reportIssues.trim() || !reportNextPlan.trim()) return;
    addWeeklyReport({
      projectCode: code,
      week: CURRENT_WEEK,
      progressRate: reportProgress,
      issues: reportIssues,
      nextPlan: reportNextPlan,
    });
    showReportForm = false;
    reportProgress = 0;
    reportIssues = '';
    reportNextPlan = '';
  }

  // ─── 헬퍼 ─────────────────────────────────────────────────────────────────
  const isOverdue = $derived(
    project?.actualEndDate && project?.plannedEndDate
      ? project.actualEndDate > project.plannedEndDate
      : false,
  );

  function lifecycleClass(lc: string | undefined): string {
    if (lc === '진행') return 'chip chip--active';
    if (lc === '완료') return 'chip chip--done';
    if (lc === '중단') return 'chip chip--risk';
    return 'chip chip--neutral';
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return '';
    return sortAsc ? ' ↑' : ' ↓';
  }
</script>

{#if !project}
  <div class="not-found">
    <p class="not-found__code">404</p>
    <p class="not-found__msg">
      프로젝트를 찾을 수 없습니다 — 코드: <code>{code}</code>
    </p>
    <a class="back-link" href="{base}/">포트폴리오로 돌아가기</a>
  </div>
{:else}
  <div class="page">

    <!-- 역할 토글 (데모) -->
    <div class="role-bar">
      <span class="role-label">역할 전환 (데모):</span>
      {#each (['admin', 'pm', 'viewer'] as const) as role}
        <button
          class="role-btn {$currentRole === role ? 'role-btn--active' : ''}"
          onclick={() => currentRole.set(role)}
        >{role}</button>
      {/each}
    </div>

    <!-- D-1 프로젝트 개요 -->
    <section class="section">
      <a class="back-link" href="{base}/">← 포트폴리오</a>
      <div class="header-top">
        <h1 class="page-title">{project.name}</h1>
        {#if project.lifecycle}
          <span class={lifecycleClass(project.lifecycle)}>{project.lifecycle}</span>
        {/if}
      </div>
      <p class="meta">{project.client}{project.pm ? ` · PM: ${project.pm}` : ''}</p>

      <div class="overview-grid">
        <div class="overview-item">
          <span class="overview-label">계약기간</span>
          <span class="overview-value">{project.startDate} ~ {project.endDate}</span>
        </div>

        {#if project.plannedEndDate}
          <div class="overview-item">
            <span class="overview-label">실제기간</span>
            <span class="overview-value">
              {project.plannedEndDate} ~ {project.actualEndDate ?? '진행중'}
              {#if isOverdue}
                <span class="overdue-badge">일정 초과</span>
              {/if}
            </span>
          </div>
        {/if}

        {#if project.progressRate !== undefined}
          <div class="overview-item overview-item--wide">
            <span class="overview-label">진척률</span>
            <div class="progress-row">
              <div class="progress-bar">
                <div class="progress-fill" style="width: {project.progressRate}%"></div>
              </div>
              <span class="overview-value tabular-nums">{project.progressRate}%</span>
            </div>
          </div>
        {/if}

        <div class="overview-item">
          <span class="overview-label">수주금액</span>
          <span class="overview-value tabular-nums fw-500">{formatAmount(project.contractAmount)}</span>
          <span class="overview-note">수주금액은 계약(Salesforce)에서 미러링된 값</span>
        </div>
      </div>
    </section>

    <!-- D-2 손익 요약 -->
    {#if pnl && signal}
      <section class="section">
        <h2 class="section-title">손익 요약</h2>
        <div class="pnl-card">
          <div class="pnl-grid">
            <div class="pnl-item">
              <span class="pnl-label">매출</span>
              <span class="pnl-value tabular-nums">{formatAmount(pnl.revenue)}</span>
              <span class="pnl-note">계약 배분 값</span>
            </div>

            <div class="pnl-sep">−</div>

            <div class="pnl-item">
              <span class="pnl-label">배정원가합</span>
              <span class="pnl-value tabular-nums">
                {canView('인건원가', $currentRole)
                  ? formatAmount(pnl.assignedCost)
                  : maskValue(pnl.assignedCost, false)}
              </span>
              <span class="pnl-note">Σ배정 인건원가</span>
            </div>

            <div class="pnl-sep">=</div>

            <div class="pnl-item pnl-result">
              <span class="pnl-label">마진</span>
              <span
                class="pnl-value tabular-nums"
                style="color: {canView('마진', $currentRole) ? signal.color : 'var(--text-secondary)'};"
              >
                {canView('마진', $currentRole)
                  ? formatAmount(pnl.margin)
                  : maskValue(pnl.margin, false)}
              </span>
            </div>

            <div class="pnl-rate">
              <span
                class="rate-badge tabular-nums"
                style="color: {canView('마진', $currentRole) ? signal.color : 'var(--text-secondary)'};"
              >
                {#if canView('마진', $currentRole)}
                  {signal.emoji} {formatPercent(pnl.marginRate)}
                {:else}
                  {maskValue(pnl.marginRate, false)}
                {/if}
              </span>
            </div>
          </div>

          <!-- 원가 소진 바 -->
          {#if canView('인건원가', $currentRole) && pnl.revenue > 0}
            {@const burnRatio = Math.min(pnl.assignedCost / pnl.revenue, 1)}
            <div class="burn-section">
              <div class="burn-header">
                <span class="burn-label">현재 소진 원가 대 수주금액</span>
                <span class="burn-pct tabular-nums">
                  {formatPercent(pnl.assignedCost / pnl.revenue)}
                </span>
              </div>
              <div class="burn-bar">
                <div
                  class="burn-fill burn-fill--{signal.level}"
                  style="width: {burnRatio * 100}%"
                ></div>
              </div>
            </div>
          {/if}

          {#if canView('마진', $currentRole)}
            {#if signal.level === 'watch'}
              <p class="warn-msg warn-msg--watch">
                ⚠️ 마진율이 낮습니다. 원가 구조를 재검토하세요.
              </p>
            {:else if signal.level === 'risk'}
              <p class="warn-msg warn-msg--risk">
                🚨 적자 프로젝트입니다. 즉각적인 조치가 필요합니다.
              </p>
            {/if}
          {/if}
        </div>
      </section>
    {/if}

    <!-- D-3 배정 드릴다운 테이블 + D-4 편집 버튼 -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">배정 드릴다운</h2>
        <div class="section-actions">
          <button
            class="btn btn--secondary btn--sm"
            onclick={resetAssignments}
            disabled={!canEdit}
          >초기화</button>
          <button
            class="btn btn--primary btn--sm"
            onclick={openAddForm}
            disabled={!canEdit}
          >+ 배정 추가</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="detail-table">
          <thead>
            <tr>
              <th class="col-text">직원</th>
              <th
                class="col-text sortable"
                onclick={() => toggleSort('grade')}
              >배정등급{sortIndicator('grade')}</th>
              <th
                class="col-text sortable"
                onclick={() => toggleSort('startDate')}
              >투입기간{sortIndicator('startDate')}</th>
              <th class="col-num">M/M</th>
              {#if canView('인건원가', $currentRole)}
                <th
                  class="col-num sortable"
                  onclick={() => toggleSort('cost')}
                >산정인건원가{sortIndicator('cost')}</th>
                <th class="col-num">원가비중</th>
              {:else}
                <th class="col-num">인건원가</th>
              {/if}
              <th class="col-action"></th>
            </tr>
          </thead>
          <tbody>
            {#each sortedRows as row (row.globalIdx)}
              <tr class="data-row">
                <td class="col-text">{row.emp?.name ?? row.a.employeeId}</td>
                <td class="col-text grade-badge">{row.effectiveGrade?.name ?? '—'}</td>
                <td class="col-text date-cell">{row.a.startDate ?? '—'}</td>
                <td class="col-num tabular-nums">{row.a.mm}</td>
                {#if canView('인건원가', $currentRole)}
                  <td class="col-num tabular-nums">{formatAmount(row.cost)}</td>
                  <td class="col-num tabular-nums">
                    {formatPercent(costShare(row.cost, totalCost))}
                  </td>
                {:else}
                  <td class="col-num masked">{maskValue(row.cost, false)}</td>
                {/if}
                <td class="col-action">
                  <button
                    class="icon-btn"
                    onclick={() => openEditForm(row.globalIdx, row.a)}
                    disabled={!canEdit}
                    title="수정"
                  >✏️</button>
                  <button
                    class="icon-btn icon-btn--danger"
                    onclick={() => removeAssignment(row.globalIdx)}
                    disabled={!canEdit}
                    title="해제"
                  >✕</button>
                </td>
              </tr>
            {/each}
            {#if sortedRows.length === 0}
              <tr>
                <td colspan="8" class="empty-row">배정된 직원이 없습니다.</td>
              </tr>
            {/if}
          </tbody>
          {#if sortedRows.length > 0 && canView('인건원가', $currentRole)}
            <tfoot>
              <tr class="total-row">
                <td class="col-text" colspan="3">합계</td>
                <td class="col-num tabular-nums">{totalMm.toFixed(1)}</td>
                <td class="col-num tabular-nums">{formatAmount(totalCost)}</td>
                <td class="col-num tabular-nums">100.0%</td>
                <td></td>
              </tr>
            </tfoot>
          {/if}
        </table>
      </div>
      <p class="table-note">
        인건원가=투입시점 등급 표준단가×M/M, 적용단가는 시점 기준
      </p>
    </section>

    <!-- D-4 배정 편집 모달 -->
    {#if showAssignForm}
      <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={(e) => e.target === e.currentTarget && closeAssignForm()}
        onkeydown={(e) => e.key === 'Escape' && closeAssignForm()}
      >
        <div class="modal">
          <h3 class="modal-title">
            {editingGlobalIdx !== null ? '배정 수정' : '배정 추가'}
          </h3>
          <div class="form-grid">
            <label class="form-label">
              직원
              <select class="form-select" bind:value={formEmployeeId}>
                <option value="">-- 선택 --</option>
                {#each employees as emp}
                  <option value={emp.id}>
                    {emp.name} ({gradeMap.get(emp.gradeId)?.name ?? emp.gradeId})
                  </option>
                {/each}
              </select>
            </label>
            <label class="form-label">
              M/M
              <input
                class="form-input tabular-nums"
                type="number"
                min="0.1"
                step="0.5"
                bind:value={formMm}
              />
            </label>
            <label class="form-label">
              투입 시작일
              <input class="form-input" type="date" bind:value={formStartDate} />
            </label>
            <label class="form-label">
              배정등급 (선택)
              <select class="form-select" bind:value={formAssignedGradeId}>
                <option value="">-- 직원 등급 사용 --</option>
                {#each grades as g}
                  <option value={g.id}>{g.name}</option>
                {/each}
              </select>
            </label>
          </div>
          <div class="modal-footer">
            <button class="btn btn--secondary btn--sm" onclick={closeAssignForm}>취소</button>
            <button
              class="btn btn--primary btn--sm"
              onclick={submitAssignForm}
              disabled={!formEmployeeId || formMm <= 0}
            >
              {editingGlobalIdx !== null ? '수정' : '추가'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- D-6 인당 기여 (인당수익) -->
    {#if perHeadRows.length > 0}
      <section class="section">
        <h2 class="section-title">인당 기여</h2>
        <div class="table-wrap">
          <table class="detail-table">
            <thead>
              <tr>
                <th class="col-text">직원</th>
                <th class="col-text">등급</th>
                <th class="col-num">인당수익</th>
                <th class="col-text">산정식</th>
              </tr>
            </thead>
            <tbody>
              {#each perHeadRows as ph}
                <tr class="data-row">
                  <td class="col-text">{ph.emp.name}</td>
                  <td class="col-text grade-badge">
                    {gradeMap.get(ph.emp.gradeId)?.name ?? '—'}
                  </td>
                  <td class="col-num tabular-nums">
                    {canView('인당수익', $currentRole)
                      ? formatAmount(ph.value)
                      : maskValue(ph.value, false)}
                  </td>
                  <td class="col-text formula-cell">
                    {canView('인당수익', $currentRole) ? ph.formula : '—'}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    <!-- D-5 주간 진척·리스크 -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">주간 진척·리스크</h2>
        {#if !hasCurrentWeekReport && !showReportForm}
          <button
            class="btn btn--primary btn--sm"
            onclick={() => (showReportForm = true)}
          >이번 주 보고 작성</button>
        {/if}
      </div>

      {#if !hasCurrentWeekReport}
        <div class="missing-report">
          <span class="missing-dot"></span>
          <span class="missing-msg">{CURRENT_WEEK} 주간보고 미작성</span>
        </div>
      {/if}

      {#if showReportForm}
        <div class="report-form">
          <h3 class="form-subtitle">{CURRENT_WEEK} 주간보고 작성</h3>
          <div class="form-grid">
            <label class="form-label">
              진척률 (0~100)
              <input
                class="form-input tabular-nums"
                type="number"
                min="0"
                max="100"
                bind:value={reportProgress}
              />
            </label>
            <label class="form-label form-full">
              이슈·리스크
              <textarea
                class="form-textarea"
                rows="2"
                bind:value={reportIssues}
              ></textarea>
            </label>
            <label class="form-label form-full">
              다음 주 계획
              <textarea
                class="form-textarea"
                rows="2"
                bind:value={reportNextPlan}
              ></textarea>
            </label>
          </div>
          <div class="form-actions">
            <button
              class="btn btn--secondary btn--sm"
              onclick={() => (showReportForm = false)}
            >취소</button>
            <button
              class="btn btn--primary btn--sm"
              onclick={submitReport}
              disabled={!reportIssues.trim() || !reportNextPlan.trim()}
            >저장</button>
          </div>
        </div>
      {/if}

      {#if filteredReports.length > 0}
        <div class="reports-list">
          {#each [...filteredReports].reverse() as report}
            <div
              class="report-card {report.week === CURRENT_WEEK ? 'report-card--current' : ''}"
            >
              <div class="report-header">
                <span class="report-week">{report.week}</span>
                <span class="report-progress tabular-nums">{report.progressRate}%</span>
              </div>
              <div class="report-body">
                <div class="report-row">
                  <span class="report-field-label">이슈</span>
                  <span class="report-field-value">{report.issues}</span>
                </div>
                <div class="report-row">
                  <span class="report-field-label">다음계획</span>
                  <span class="report-field-value">{report.nextPlan}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-msg">주간보고가 없습니다.</p>
      {/if}
    </section>

  </div>
{/if}

<style>
  /* ─── 404 ──────────────────────────────────────────────────────────────── */
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 64px 24px;
    text-align: center;
  }
  .not-found__code {
    font-size: 48px;
    font-weight: 600;
    color: var(--border-strong);
    line-height: 1;
  }
  .not-found__msg {
    font-size: var(--text-base);
    color: var(--text-secondary);
  }
  .not-found__msg code {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: var(--text-sm);
    background: var(--surface-muted);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
  }

  /* ─── 공통 ─────────────────────────────────────────────────────────────── */
  .back-link {
    color: var(--accent);
    text-decoration: none;
    font-size: var(--text-sm);
    display: inline-block;
    margin-bottom: 4px;
  }
  .back-link:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  .page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink);
    line-height: 24px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .section-actions {
    display: flex;
    gap: 6px;
  }

  /* ─── 역할 토글 ─────────────────────────────────────────────────────────── */
  .role-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }
  .role-label {
    color: var(--text-secondary);
    font-weight: 500;
    margin-right: 2px;
  }
  .role-btn {
    padding: 2px 10px;
    font-size: var(--text-xs);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
  }
  .role-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .role-btn--active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  /* ─── D-1 개요 ──────────────────────────────────────────────────────────── */
  .header-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 4px 0 2px;
  }
  .page-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--ink);
    line-height: 28px;
  }
  .meta {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    font-size: var(--text-xs);
    font-weight: 500;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .chip--active {
    color: var(--accent);
    background: var(--accent-weak);
    border-color: var(--accent);
  }
  .chip--done {
    color: var(--text-secondary);
    background: var(--surface-muted);
    border-color: var(--border);
  }
  .chip--risk {
    color: var(--health-risk);
    background: transparent;
    border: 1px dashed var(--health-risk);
  }
  .chip--neutral {
    color: var(--text-secondary);
    background: var(--surface-muted);
    border-color: var(--border);
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 16px;
  }
  .overview-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .overview-item--wide {
    grid-column: span 2;
  }
  .overview-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .overview-value {
    font-size: var(--text-base);
    color: var(--text);
    font-weight: 400;
  }
  .fw-500 {
    font-weight: 500;
  }
  .overview-note {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .overdue-badge {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 6px;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--health-risk);
    border: 1px solid var(--health-risk);
    border-radius: var(--radius-sm);
  }

  .progress-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;
  }
  .progress-bar {
    flex: 1;
    height: 6px;
    background: var(--surface-muted);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  /* ─── D-2 손익 요약 ─────────────────────────────────────────────────────── */
  .pnl-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .pnl-grid {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    flex-wrap: wrap;
  }
  .pnl-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pnl-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .pnl-value {
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--text);
  }
  .pnl-note {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .pnl-sep {
    font-size: var(--text-xl);
    color: var(--border-strong);
    font-weight: 400;
    padding-bottom: 20px;
  }
  .pnl-result .pnl-value {
    font-size: var(--text-xl);
  }
  .pnl-rate {
    margin-left: auto;
  }
  .rate-badge {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .burn-section {
    border-top: 1px solid var(--border);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .burn-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .burn-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: 500;
  }
  .burn-pct {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: 500;
  }
  .burn-bar {
    height: 8px;
    background: var(--surface-muted);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .burn-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .burn-fill--ok    { background: var(--health-ok); }
  .burn-fill--watch { background: var(--health-watch); }
  .burn-fill--risk  { background: var(--health-risk); }

  .warn-msg {
    font-size: var(--text-sm);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border-left: 3px solid;
  }
  .warn-msg--watch {
    color: #B45309;
    border-color: var(--health-watch);
    background: #FFFBEB;
  }
  .warn-msg--risk {
    color: var(--health-risk);
    border-color: var(--health-risk);
    background: #FEF2F2;
  }

  /* ─── 공통 테이블 ───────────────────────────────────────────────────────── */
  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }
  .detail-table thead tr {
    background: var(--surface-muted);
    border-bottom: 1px solid var(--border-strong);
  }
  .detail-table th {
    padding: 8px 12px;
    font-weight: 500;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .detail-table th.col-num {
    text-align: right;
  }
  .sortable {
    cursor: pointer;
    user-select: none;
  }
  .sortable:hover {
    color: var(--accent);
  }

  .data-row {
    border-bottom: 1px solid var(--border);
    transition: background-color 0.1s;
  }
  .data-row:hover {
    background-color: var(--accent-weak);
  }
  .data-row:last-child {
    border-bottom: none;
  }
  .detail-table td {
    padding: 9px 12px;
    color: var(--text);
    white-space: nowrap;
  }
  .col-text { text-align: left; }
  .col-num  { text-align: right; }
  .col-action {
    text-align: right;
    width: 64px;
    white-space: nowrap;
  }

  .grade-badge {
    color: var(--text-secondary);
  }
  .date-cell {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .formula-cell {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .masked {
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }
  .empty-row {
    text-align: center;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    padding: 20px;
  }
  .total-row {
    background: var(--surface-muted);
    border-top: 1px solid var(--border-strong);
    font-weight: 500;
  }
  .total-row td {
    padding: 8px 12px;
    font-size: var(--text-sm);
    color: var(--text);
  }
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
  .table-note {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    padding: 0 2px;
  }

  /* ─── 아이콘 버튼 ───────────────────────────────────────────────────────── */
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    font-size: 12px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-secondary);
    transition: background-color 0.1s;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--surface-muted);
    color: var(--text);
  }
  .icon-btn--danger:hover:not(:disabled) {
    background: #FEF2F2;
    color: var(--health-risk);
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ─── 버튼 ──────────────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.1s, border-color 0.1s;
  }
  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn--sm {
    padding: 5px 12px;
    font-size: var(--text-sm);
  }
  .btn--primary {
    background: var(--accent);
    color: #fff;
    border: 1px solid var(--accent);
  }
  .btn--primary:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  .btn--secondary {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border-strong);
  }
  .btn--secondary:hover:not(:disabled) {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* ─── D-4 배정 편집 모달 ────────────────────────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 24px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .modal-title {
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--ink);
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .form-full {
    grid-column: span 2;
  }
  .form-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text);
  }
  .form-input,
  .form-select,
  .form-textarea {
    padding: 6px 10px;
    font-size: var(--text-sm);
    font-family: inherit;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    outline: none;
  }
  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(14, 116, 144, 0.15);
  }
  .form-textarea {
    resize: vertical;
    min-height: 60px;
  }
  .form-subtitle {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--ink);
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  /* ─── D-5 주간 보고 ─────────────────────────────────────────────────────── */
  .missing-report {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface);
    border: 1px dashed var(--status-missing, #CBD5E1);
    border-radius: var(--radius-sm);
  }
  .missing-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-missing, #CBD5E1);
    flex-shrink: 0;
  }
  .missing-msg {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .report-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .reports-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .report-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .report-card--current {
    border-left: 3px solid var(--accent);
    padding-left: 13px;
  }
  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .report-week {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink);
    font-family: 'JetBrains Mono', ui-monospace, monospace;
  }
  .report-progress {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--accent);
  }
  .report-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .report-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .report-field-label {
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    min-width: 56px;
    padding-top: 1px;
  }
  .report-field-value {
    font-size: var(--text-sm);
    color: var(--text);
  }

  .empty-msg {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    padding: 12px 0;
  }
</style>
