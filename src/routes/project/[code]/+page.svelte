<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { projectPnl, assignmentCost } from '$lib/pnl';
  import { formatAmount, formatPercent, marginSignal } from '$lib/format';
  import { grades, employees, projects, assignments } from '$lib/data/mock';
  import type { Assignment } from '$lib/types';

  // 현재 프로젝트 코드
  const code = $derived($page.params.code);

  // 프로젝트 조회
  const project = $derived(projects.find((p) => p.code === code));

  // 해당 프로젝트 원본 배정
  const originalAssignments = $derived(
    assignments.filter((a) => a.projectCode === code),
  );

  // 로컬 배정 상태 (M/M 조정용) — 원본 배정 변경 시 초기화
  let localAssignments = $state<Assignment[]>([]);

  // 원본이 바뀔 때(코드 이동) localAssignments 동기화
  $effect(() => {
    localAssignments = originalAssignments.map((a) => ({ ...a }));
  });

  // 등급·직원 Map
  const gradeMap = $derived(new Map(grades.map((g) => [g.id, g])));
  const employeeMap = $derived(new Map(employees.map((e) => [e.id, e])));

  // 배정 행 파생 (직원명·등급명·비용 포함)
  const assignmentRows = $derived(
    localAssignments.map((a) => {
      const emp = employeeMap.get(a.employeeId);
      const grade = emp ? gradeMap.get(emp.gradeId) : undefined;
      const cost = assignmentCost(a, grade);
      return {
        assignment: a,
        employeeName: emp?.name ?? a.employeeId,
        gradeName: grade?.name ?? '-',
        cost,
      };
    }),
  );

  // M/M 입력 핸들러
  function updateMm(idx: number, value: number) {
    localAssignments = localAssignments.map((a, i) =>
      i === idx ? { ...a, mm: Math.max(0, value) } : a,
    );
  }

  // 프로젝트 손익 재계산 (로컬 배정 기반)
  const pnl = $derived(
    project
      ? (() => {
          const assignedCostTotal = assignmentRows.reduce((s, r) => s + r.cost, 0);
          const revenue = project.contractAmount;
          const margin = revenue - assignedCostTotal;
          const marginRate = revenue > 0 ? margin / revenue : 0;
          return { revenue, assignedCost: assignedCostTotal, margin, marginRate };
        })()
      : null,
  );

  const signal = $derived(pnl ? marginSignal(pnl.marginRate) : null);
</script>

{#if !project}
  <div class="not-found">
    <p class="not-found__code">404</p>
    <p class="not-found__msg">프로젝트를 찾을 수 없습니다 — 코드: <code>{code}</code></p>
    <a class="back-link" href="{base}/">포트폴리오로 돌아가기</a>
  </div>
{:else}
  <div class="page">
    <div class="page-header">
      <a class="back-link" href="{base}/">← 포트폴리오</a>
      <h1 class="page-title">{project.name}</h1>
      <p class="meta">{project.client} · {project.startDate} ~ {project.endDate}</p>
    </div>

    <!-- 배정 원장 테이블 -->
    <section class="section">
      <h2 class="section-title">배정 원장</h2>
      <div class="table-wrap">
        <table class="detail-table">
          <thead>
            <tr>
              <th class="col-text">직원</th>
              <th class="col-text">등급</th>
              <th class="col-num">M/M</th>
              <th class="col-num">산정원가</th>
            </tr>
          </thead>
          <tbody>
            {#each assignmentRows as row, idx}
              <tr class="data-row">
                <td class="col-text">{row.employeeName}</td>
                <td class="col-text grade-badge">{row.gradeName}</td>
                <td class="col-num">
                  <input
                    class="mm-input tabular-nums"
                    type="number"
                    min="0"
                    step="0.5"
                    value={row.assignment.mm}
                    oninput={(e) => updateMm(idx, parseFloat((e.target as HTMLInputElement).value) || 0)}
                  />
                </td>
                <td class="col-num tabular-nums">{formatAmount(row.cost)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <!-- 손익 브레이크다운 -->
    {#if pnl && signal}
      <section class="section">
        <h2 class="section-title">손익 브레이크다운</h2>
        <div class="breakdown-card">
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-label">매출(수주)</span>
              <span class="breakdown-value tabular-nums">{formatAmount(pnl.revenue)}</span>
            </div>
            <div class="breakdown-sep">−</div>
            <div class="breakdown-item">
              <span class="breakdown-label">배정원가 합계</span>
              <span class="breakdown-value tabular-nums">{formatAmount(pnl.assignedCost)}</span>
            </div>
            <div class="breakdown-sep">=</div>
            <div class="breakdown-item breakdown-result">
              <span class="breakdown-label">마진</span>
              <span
                class="breakdown-value tabular-nums"
                style="color: {signal.color}; font-weight: 600;"
              >
                {formatAmount(pnl.margin)}
              </span>
            </div>
            <div class="breakdown-rate">
              <span
                class="rate-badge tabular-nums"
                style="color: {signal.color};"
              >
                {signal.emoji} {formatPercent(pnl.marginRate)}
              </span>
            </div>
          </div>

          {#if signal.level === 'watch'}
            <p class="warn-msg warn-msg--watch">
              ⚠️ 마진율이 낮습니다. 원가 구조를 재검토하세요.
            </p>
          {:else if signal.level === 'risk'}
            <p class="warn-msg warn-msg--risk">
              🚨 적자 프로젝트입니다. 즉각적인 조치가 필요합니다.
            </p>
          {/if}
        </div>
      </section>
    {/if}
  </div>
{/if}

<style>
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

  .back-link {
    color: var(--accent);
    text-decoration: none;
    font-size: var(--text-sm);
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

  .page-header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--ink);
    line-height: 28px;
    margin-top: 4px;
  }

  .meta {
    font-size: var(--text-sm);
    color: var(--text-secondary);
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
    padding: 10px 12px;
    color: var(--text);
    white-space: nowrap;
  }

  .col-text {
    text-align: left;
  }

  .col-num {
    text-align: right;
  }

  .grade-badge {
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .mm-input {
    width: 72px;
    padding: 4px 8px;
    font-size: var(--text-sm);
    text-align: right;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    outline: none;
    font-variant-numeric: tabular-nums;
  }

  .mm-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(14, 116, 144, 0.15);
  }

  /* 브레이크다운 카드 */
  .breakdown-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .breakdown-grid {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .breakdown-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .breakdown-label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .breakdown-value {
    font-size: var(--text-lg);
    font-weight: 500;
    color: var(--text);
  }

  .breakdown-sep {
    font-size: var(--text-xl);
    color: var(--border-strong);
    font-weight: 400;
    padding-bottom: 2px;
  }

  .breakdown-result .breakdown-value {
    font-size: var(--text-xl);
  }

  .breakdown-rate {
    margin-left: auto;
  }

  .rate-badge {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .warn-msg {
    font-size: var(--text-sm);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border-left: 3px solid;
  }

  .warn-msg--watch {
    color: var(--health-watch);
    border-color: var(--health-watch);
    background: #FFFBEB;
  }

  .warn-msg--risk {
    color: var(--health-risk);
    border-color: var(--health-risk);
    background: #FEF2F2;
  }
</style>
