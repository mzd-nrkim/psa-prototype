<script lang="ts">
  import { formatPercent } from '$lib/format';
  import { grades, employees, assignments } from '$lib/data/mock';

  // 기준 M/M (6mm = 100%)
  const BASE_MM = 6;

  // 등급 Map
  const gradeMap = new Map(grades.map((g) => [g.id, g]));

  // 직원별 투입 현황 계산
  const utilRows = employees.map((emp) => {
    const empAssignments = assignments.filter((a) => a.employeeId === emp.id);
    const totalMm = empAssignments.reduce((s, a) => s + a.mm, 0);
    const utilRate = totalMm / BASE_MM; // 0~1 이상 가능
    const grade = gradeMap.get(emp.gradeId);
    return {
      employee: emp,
      gradeName: grade?.name ?? '-',
      totalMm,
      utilRate,
      isBench: totalMm === 0,
      isOver: utilRate > 1,
      projects: empAssignments,
    };
  });

  // 투입률 기준 내림차순 정렬
  const sortedRows = [...utilRows].sort((a, b) => b.utilRate - a.utilRate);
</script>

<div class="page">
  <h1 class="page-title">임직원 투입 현황</h1>
  <p class="page-sub">기준 M/M: {BASE_MM}mm = 100%</p>

  <div class="table-wrap">
    <table class="people-table">
      <thead>
        <tr>
          <th class="col-name">직원</th>
          <th class="col-grade">등급</th>
          <th class="col-mm">투입 M/M</th>
          <th class="col-rate">투입률</th>
          <th class="col-bar">투입 현황</th>
          <th class="col-status">상태</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedRows as row}
          <tr class="data-row" class:row--bench={row.isBench} class:row--over={row.isOver}>
            <td class="col-name">{row.employee.name}</td>
            <td class="col-grade">
              <span class="grade-chip">{row.gradeName}</span>
            </td>
            <td class="col-mm tabular-nums">
              {row.totalMm.toFixed(1)}mm
            </td>
            <td class="col-rate tabular-nums">
              <span
                class="rate-value"
                class:rate--over={row.isOver}
              >
                {formatPercent(row.utilRate)}
              </span>
            </td>
            <td class="col-bar">
              <div class="bar-track">
                {#if row.isOver}
                  <!-- 과투입: 100% 채움 + 초과분 표시 -->
                  <div class="bar-fill bar-fill--billable" style="width: 100%;"></div>
                  <div
                    class="bar-overflow"
                    title="과투입 {formatPercent(row.utilRate - 1)} 초과"
                  >+</div>
                {:else if row.isBench}
                  <div class="bar-fill bar-fill--bench" style="width: 100%;"></div>
                {:else}
                  <div
                    class="bar-fill bar-fill--billable"
                    style="width: {Math.min(row.utilRate * 100, 100)}%;"
                  ></div>
                {/if}
              </div>
            </td>
            <td class="col-status">
              {#if row.isOver}
                <span class="status-chip status-chip--over">과투입</span>
              {:else if row.isBench}
                <span class="status-chip status-chip--bench">벤치</span>
              {:else}
                <span class="status-chip status-chip--active">투입중</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .page-title {
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--ink);
    line-height: 28px;
  }

  .page-sub {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: -4px;
  }

  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .people-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .people-table thead tr {
    background: var(--surface-muted);
    border-bottom: 1px solid var(--border-strong);
  }

  .people-table th {
    padding: 8px 12px;
    font-weight: 500;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    text-align: left;
  }

  .people-table th.col-mm,
  .people-table th.col-rate {
    text-align: right;
  }

  .people-table th.col-bar {
    min-width: 160px;
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

  /* 벤치 행 — 옅게 */
  .row--bench {
    opacity: 0.72;
  }

  .people-table td {
    padding: 10px 12px;
    color: var(--text);
    white-space: nowrap;
  }

  .col-name {
    font-weight: 500;
  }

  .col-grade {
    color: var(--text-secondary);
  }

  .col-mm,
  .col-rate {
    text-align: right;
  }

  .grade-chip {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    background: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 1px 6px;
  }

  .rate-value {
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    color: var(--text);
  }

  .rate--over {
    color: var(--health-watch);
    font-weight: 600;
  }

  /* 막대 */
  .bar-track {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 12px;
    background: var(--surface-muted);
    border-radius: 6px;
    overflow: visible;
    position: relative;
    width: 160px;
  }

  .bar-fill {
    height: 100%;
    border-radius: 6px;
    transition: width 0.2s ease;
    min-width: 2px;
  }

  .bar-fill--billable {
    background: var(--util-billable);
  }

  .bar-fill--bench {
    background: var(--util-bench);
    width: 100%;
    opacity: 0.35;
  }

  .bar-overflow {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--health-watch);
    margin-left: 4px;
    flex-shrink: 0;
  }

  /* 상태 칩 */
  .status-chip {
    display: inline-flex;
    align-items: center;
    font-size: var(--text-xs);
    font-weight: 500;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid;
  }

  .status-chip--active {
    color: var(--util-billable);
    border-color: var(--util-billable);
    background: transparent;
  }

  .status-chip--bench {
    color: var(--util-bench);
    border-color: var(--util-bench);
    background: transparent;
  }

  .status-chip--over {
    color: var(--health-watch);
    border-color: var(--health-watch);
    background: transparent;
  }
</style>
