/**
 * PSA 포트폴리오·헬스 순수 함수 단위 테스트
 *
 * 금액 단위: 만원 / marginRate: 0~1 비율
 *
 * 손계산 검산:
 *   P-001  assignedCost = 720×6 + 520×4 + 380×4 = 7,920  margin = 7,080  marginRate ≈ 0.472
 *   P-002  assignedCost = 720×4 + 520×3 + 380×2 = 5,200  margin = 3,000  marginRate ≈ 0.366
 *   P-003  assignedCost = 980×4 + 720×2 + 520×2 = 6,400  margin =  -400  marginRate ≈ -0.067
 *   P-004  assignedCost = 0                               margin = 5,000  marginRate = 1.0
 *   Σ margin = 14,680 / Σ contract = 34,200
 */

import { describe, it, expect } from 'vitest';
import { projectHealth } from './health.js';
import {
  portfolioSummary,
  healthGradeCounts,
  utilizationSummary,
} from './portfolio.js';
import { projectPnl, portfolioRollup } from './pnl.js';
import { projects, assignments, employees, grades } from './data/mock.js';
import type { Project } from './types.js';

// ─── 내부 상수 (손계산 기준) ─────────────────────────────────────────────────

const P001_MARGIN   = 7080;   // 15000 - 7920
const P002_MARGIN   = 3000;   // 8200  - 5200
const P003_MARGIN   = -400;   // 6000  - 6400
const P004_MARGIN   = 5000;   // 5000  - 0
const TOTAL_MARGIN  = P001_MARGIN + P002_MARGIN + P003_MARGIN + P004_MARGIN; // 14680
const TOTAL_CONTRACT = 34200; // 15000 + 8200 + 6000 + 5000

// ─── projectHealth ────────────────────────────────────────────────────────────

describe('projectHealth — 개별 프로젝트 헬스 판정', () => {
  it('P-001: marginRate ≈ 0.472, 지연 없음 → 정상 / reasons 비어 있음', () => {
    const pnl = projectPnl(projects[0], assignments, employees, grades);
    expect(pnl.marginRate).toBeCloseTo(P001_MARGIN / 15000, 3); // ≈ 0.472
    const h = projectHealth(projects[0], pnl);
    expect(h.grade).toBe('정상');
    expect(h.reasons).toHaveLength(0);
  });

  it('P-002: marginRate ≈ 0.366, actualEnd 2026-08-15 > planned 2026-07-31 → 주의(일정지연)', () => {
    const pnl = projectPnl(projects[1], assignments, employees, grades);
    expect(pnl.marginRate).toBeCloseTo(P002_MARGIN / 8200, 3); // ≈ 0.366
    const h = projectHealth(projects[1], pnl);
    expect(h.grade).toBe('주의');
    expect(h.reasons).toContain('일정지연');
    expect(h.reasons).not.toContain('적자');
    expect(h.reasons).not.toContain('저마진');
  });

  it('P-003: marginRate ≈ -0.067(적자) + 일정지연 → 위험 / reasons 2개', () => {
    const pnl = projectPnl(projects[2], assignments, employees, grades);
    expect(pnl.marginRate).toBeCloseTo(P003_MARGIN / 6000, 3); // ≈ -0.067
    const h = projectHealth(projects[2], pnl);
    expect(h.grade).toBe('위험');
    expect(h.reasons).toContain('적자');
    expect(h.reasons).toContain('일정지연');
    expect(h.reasons).toHaveLength(2);
  });

  it('P-004: 배정 없음(marginRate=1.0), actualEndDate undefined → 정상 / 크래시 없음(Existence)', () => {
    expect(projects[3].actualEndDate).toBeUndefined();
    const pnl = projectPnl(projects[3], assignments, employees, grades);
    expect(pnl.marginRate).toBeCloseTo(1.0, 5);
    expect(() => projectHealth(projects[3], pnl)).not.toThrow();
    const h = projectHealth(projects[3], pnl);
    expect(h.grade).toBe('정상');
    expect(h.reasons).toHaveLength(0);
    expect(h.reasons).not.toContain('일정지연');
  });
});

// ─── healthGradeCounts ────────────────────────────────────────────────────────

describe('healthGradeCounts — 등급별 집계', () => {
  it('전체 mock: {정상:2, 주의:1, 위험:1} (Right)', () => {
    const c = healthGradeCounts(projects, assignments, employees, grades);
    expect(c.정상).toBe(2);
    expect(c.주의).toBe(1);
    expect(c.위험).toBe(1);
  });

  it('Range: 합계 = projects.length', () => {
    const c = healthGradeCounts(projects, assignments, employees, grades);
    expect(c.정상 + c.주의 + c.위험).toBe(projects.length);
  });

  it('Boundary: 프로젝트 0건 → 모두 0 / 합계 0', () => {
    const c = healthGradeCounts([], [], employees, grades);
    expect(c.정상).toBe(0);
    expect(c.주의).toBe(0);
    expect(c.위험).toBe(0);
    expect(c.정상 + c.주의 + c.위험).toBe(0);
  });

  it('Cardinality: 프로젝트 1건(P-001 진행·정상) → 합계=1, 정상=1', () => {
    const c = healthGradeCounts([projects[0]], assignments, employees, grades);
    expect(c.정상 + c.주의 + c.위험).toBe(1);
    expect(c.정상).toBe(1);
  });

  it('Cardinality: 전체 4건 → 합계 = 4', () => {
    const c = healthGradeCounts(projects, assignments, employees, grades);
    expect(c.정상 + c.주의 + c.위험).toBe(4);
  });
});

// ─── portfolioSummary ─────────────────────────────────────────────────────────

describe('portfolioSummary — 전사 포트폴리오 요약', () => {
  it('전체 mock 확정값 검증 (Right)', () => {
    const s = portfolioSummary(projects, assignments, employees, grades);
    // P-001·P-002 lifecycle='진행' → activeCount=2
    expect(s.activeCount).toBe(2);
    // P-003 위험 → riskCount=1
    expect(s.riskCount).toBe(1);
    // 15000+8200+6000+5000
    expect(s.totalContract).toBe(TOTAL_CONTRACT);
    // 14680 / 34200
    expect(s.marginRate).toBeCloseTo(TOTAL_MARGIN / TOTAL_CONTRACT, 5);
  });

  it('Boundary: 프로젝트 0건 → activeCount/riskCount=0, 나눗셈 안전(NaN 없음)', () => {
    const s = portfolioSummary([], [], employees, grades);
    expect(s.activeCount).toBe(0);
    expect(s.riskCount).toBe(0);
    expect(s.totalContract).toBe(0);
    expect(isNaN(s.marginRate)).toBe(false);
  });

  it('Cardinality: 프로젝트 1건(P-001 진행) → activeCount=1, totalContract=15000', () => {
    const s = portfolioSummary([projects[0]], assignments, employees, grades);
    expect(s.activeCount).toBe(1);
    expect(s.totalContract).toBe(15000);
  });

  it('Cardinality: 프로젝트 N건(P-003 중단·P-004 제안) → activeCount=0', () => {
    const s = portfolioSummary(
      [projects[2], projects[3]],
      assignments,
      employees,
      grades,
    );
    expect(s.activeCount).toBe(0);
  });
});

// ─── portfolioRollup Cross-check ──────────────────────────────────────────────

describe('Cross-check — portfolioRollup 마진율 독립 재계산 대조', () => {
  it('portfolioRollup.marginRate = Σmargin / Σcontract 손계산과 일치', () => {
    const rollup = portfolioRollup(projects, assignments, employees, grades);
    // Σ margin = 7080 + 3000 + (-400) + 5000 = 14680
    // Σ contract = 34200
    expect(rollup.marginRate).toBeCloseTo(TOTAL_MARGIN / TOTAL_CONTRACT, 5);
  });

  it('portfolioSummary.marginRate = portfolioRollup.marginRate (포함 일치)', () => {
    const summary = portfolioSummary(projects, assignments, employees, grades);
    const rollup  = portfolioRollup(projects, assignments, employees, grades);
    expect(summary.marginRate).toBeCloseTo(rollup.marginRate, 10);
  });

  it('각 프로젝트 개별 marginRate 합산 마진 = Σ손계산 마진', () => {
    const manualMargins = [P001_MARGIN, P002_MARGIN, P003_MARGIN, P004_MARGIN];
    const manualSum = manualMargins.reduce((a, b) => a + b, 0);
    expect(manualSum).toBe(TOTAL_MARGIN);

    const pnls = projects.map((p) => projectPnl(p, assignments, employees, grades));
    const pnlMargins = pnls.map((pnl, i) => pnl.marginRate * projects[i].contractAmount);
    const pnlSum = pnlMargins.reduce((a, b) => a + b, 0);
    expect(pnlSum).toBeCloseTo(TOTAL_MARGIN, 1);
  });
});

// ─── Error — 0 나눗셈 방어 ────────────────────────────────────────────────────

describe('Error — contractAmount=0 나눗셈 NaN 방어', () => {
  it('contractAmount=0 프로젝트 → marginRate NaN 없음, projectHealth 크래시 없음', () => {
    const zeroProject: Project = { ...projects[3], contractAmount: 0 };
    const pnl = projectPnl(zeroProject, [], employees, grades);
    expect(isNaN(pnl.marginRate)).toBe(false);
    expect(() => projectHealth(zeroProject, pnl)).not.toThrow();
  });
});

// ─── utilizationSummary ───────────────────────────────────────────────────────

describe('utilizationSummary — 인력 가동 현황', () => {
  it('전체 mock 확정값 검증 (Right)', () => {
    const u = utilizationSummary(employees, assignments, grades);
    expect(u.assignedCount).toBe(7);        // E-01~E-07
    expect(u.benchCount).toBe(2);           // E-08·E-09
    expect(u.utilizationRate).toBeCloseTo(7 / 9, 5);
    expect(u.expectedBenchCost).toBe(5400); // 520×6 + 380×6
    expect(u.unassignedRatio).toBeCloseTo(2 / 9, 5);
  });

  it('Range: utilizationRate·unassignedRatio ∈ [0, 1]', () => {
    const u = utilizationSummary(employees, assignments, grades);
    expect(u.utilizationRate).toBeGreaterThanOrEqual(0);
    expect(u.utilizationRate).toBeLessThanOrEqual(1);
    expect(u.unassignedRatio).toBeGreaterThanOrEqual(0);
    expect(u.unassignedRatio).toBeLessThanOrEqual(1);
  });

  it('Boundary: employees 0건 → 모두 0', () => {
    const u = utilizationSummary([], assignments, grades);
    expect(u.assignedCount).toBe(0);
    expect(u.benchCount).toBe(0);
    expect(u.utilizationRate).toBe(0);
    expect(u.expectedBenchCost).toBe(0);
    expect(u.unassignedRatio).toBe(0);
  });

  it('Cardinality: 벤치 0명 — E-01~E-07 전원 배정 → benchCount=0', () => {
    // employees.slice(0,7) = E-01~E-07, 모두 assignments 에 존재
    const u = utilizationSummary(employees.slice(0, 7), assignments, grades);
    expect(u.benchCount).toBe(0);
    expect(u.expectedBenchCost).toBe(0);
    expect(u.utilizationRate).toBeCloseTo(1, 5);
    expect(u.unassignedRatio).toBeCloseTo(0, 5);
  });

  it('Cardinality: 벤치 N명 — E-08(중급 520) · E-09(초급 380) → expectedBenchCost = 5400', () => {
    const u = utilizationSummary(employees, assignments, grades);
    expect(u.benchCount).toBe(2);
    // E-08: standardCost 520 × 6mm = 3120
    // E-09: standardCost 380 × 6mm = 2280
    expect(u.expectedBenchCost).toBe(5400);
  });
});
