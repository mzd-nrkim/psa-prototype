<script lang="ts">
  import { projectPnl, portfolioRollup } from '$lib/pnl';
  import { formatAmount, formatPercent, marginSignal } from '$lib/format';
  import { grades, employees, projects, assignments } from '$lib/data/mock';

  const rows = projects.map((p) => ({
    project: p,
    pnl: projectPnl(p, assignments, employees, grades),
  }));

  const rollup = portfolioRollup(projects, assignments, employees, grades);
  const rollupSignal = marginSignal(rollup.marginRate);
</script>

<div class="page">
  <h1 class="page-title">전사 포트폴리오</h1>

  <div class="table-wrap">
    <table class="pf-table">
      <thead>
        <tr>
          <th class="col-name">프로젝트</th>
          <th class="col-client">고객사</th>
          <th class="col-num">수주</th>
          <th class="col-num">배정원가</th>
          <th class="col-num">마진</th>
          <th class="col-num">마진율</th>
          <th class="col-signal">상태</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as { project, pnl }}
          {@const sig = marginSignal(pnl.marginRate)}
          <tr class="data-row">
            <td class="col-name">
              <a class="row-link" href="/project/{project.code}">{project.name}</a>
            </td>
            <td class="col-client">{project.client}</td>
            <td class="col-num tabular-nums">{formatAmount(pnl.revenue)}</td>
            <td class="col-num tabular-nums">{formatAmount(pnl.assignedCost)}</td>
            <td class="col-num tabular-nums" style="color: {sig.color}; font-weight: 500;">
              {formatAmount(pnl.margin)}
            </td>
            <td class="col-num tabular-nums" style="color: {sig.color}; font-weight: 500;">
              {formatPercent(pnl.marginRate)}
            </td>
            <td class="col-signal">
              <span class="signal-dot" style="color: {sig.color};">{sig.emoji}</span>
            </td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td class="col-name total-label" colspan="2">전사 합계</td>
          <td class="col-num tabular-nums">{formatAmount(rollup.totalRevenue)}</td>
          <td class="col-num tabular-nums">{formatAmount(rollup.totalCost)}</td>
          <td class="col-num tabular-nums" style="color: {rollupSignal.color}; font-weight: 600;">
            {formatAmount(rollup.totalMargin)}
          </td>
          <td class="col-num tabular-nums" style="color: {rollupSignal.color}; font-weight: 600;">
            {formatPercent(rollup.marginRate)}
          </td>
          <td class="col-signal">
            <span class="signal-dot" style="color: {rollupSignal.color};">{rollupSignal.emoji}</span>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--ink);
    line-height: 28px;
  }

  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
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
    padding: 8px 12px;
    font-weight: 500;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .pf-table th.col-num {
    text-align: right;
  }

  .pf-table th.col-signal {
    text-align: center;
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

  .pf-table td {
    padding: 10px 12px;
    color: var(--text);
    white-space: nowrap;
  }

  .col-name {
    text-align: left;
    min-width: 160px;
  }

  .col-client {
    text-align: left;
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }

  .col-num {
    text-align: right;
    min-width: 80px;
  }

  .col-signal {
    text-align: center;
    width: 48px;
  }

  .row-link {
    color: var(--accent);
    text-decoration: none;
    font-weight: 500;
  }

  .row-link:hover {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  .signal-dot {
    font-size: 14px;
    line-height: 1;
  }

  /* 합계 행 */
  .total-row {
    background: var(--surface-muted);
    border-top: 2px solid var(--border-strong);
  }

  .total-row td {
    padding: 10px 12px;
    font-size: var(--text-sm);
  }

  .total-label {
    font-weight: 600;
    color: var(--ink);
  }
</style>
