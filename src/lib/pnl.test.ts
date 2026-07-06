/**
 * PSA 손익 파생 계산 단위 테스트
 *
 * 실행: vitest run (node_modules 설치 후)
 * 단위 규약:
 *   금액: 만원 | marginRate: 0~1 비율 | mm: man-month
 */
import { describe, it, expect } from 'vitest';
import { assignmentCost, projectPnl, portfolioRollup } from './pnl.js';
import { formatAmount, formatPercent, marginSignal } from './format.js';
import { grades, employees, projects, assignments } from './data/mock.js';
import type { Assignment, Employee, Grade, Project } from './types.js';

// ─── assignmentCost ───────────────────────────────────────────────────────────

describe('assignmentCost', () => {
  const grade: Grade = { id: 'G-03', name: '고급', standardCost: 720, billRate: 980 };
  const baseAssignment: Assignment = { projectCode: 'P-001', employeeId: 'E-01', mm: 6 };

  // Right: standardCost × mm 정확값
  it('Right: 720(고급) × 6mm = 4320', () => {
    expect(assignmentCost(baseAssignment, grade)).toBe(4320);
  });

  it('Right: 380(초급) × 4mm = 1520', () => {
    const g01: Grade = { id: 'G-01', name: '초급', standardCost: 380, billRate: 520 };
    const a: Assignment = { projectCode: 'P-001', employeeId: 'E-04', mm: 4 };
    expect(assignmentCost(a, g01)).toBe(1520);
  });

  // Boundary: mm=0
  it('Boundary: mm=0 이면 원가 0', () => {
    const a0: Assignment = { projectCode: 'P-001', employeeId: 'E-01', mm: 0 };
    expect(assignmentCost(a0, grade)).toBe(0);
  });

  // Error: grade undefined → 0 (NaN 오염 없음)
  it('Error: grade=undefined → 0 반환, NaN 아님', () => {
    const a: Assignment = { projectCode: 'P-001', employeeId: 'E-BAD', mm: 3 };
    const result = assignmentCost(a, undefined);
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });
});

// ─── projectPnl ─────────────────────────────────────────────────────────────

describe('projectPnl', () => {
  const p001 = projects.find((p) => p.code === 'P-001')!;
  const p002 = projects.find((p) => p.code === 'P-002')!;
  const p003 = projects.find((p) => p.code === 'P-003')!;

  // Right: P-001 검산값 (assignedCost 7920, margin 7080, marginRate 0.472)
  it('Right: P-001 손익 = 매출 15000 − 원가 7920 = 마진 7080, 47.2%', () => {
    const pnl = projectPnl(p001, assignments, employees, grades);
    expect(pnl.revenue).toBe(15000);
    expect(pnl.assignedCost).toBe(7920);
    expect(pnl.margin).toBe(7080);
    expect(pnl.marginRate).toBeCloseTo(0.472, 3);
  });

  it('Right: P-002 손익 = 매출 8200 − 원가 5200 = 마진 3000, 36.6%', () => {
    const pnl = projectPnl(p002, assignments, employees, grades);
    expect(pnl.assignedCost).toBe(5200);
    expect(pnl.margin).toBe(3000);
    expect(pnl.marginRate).toBeCloseTo(0.3659, 3);
  });

  // Boundary: 적자 프로젝트 (원가 > 수주) → 마진 음수·마진율 음수 허용
  it('Boundary: P-003 적자 = 매출 6000 − 원가 6400 = 마진 -400, -6.7%', () => {
    const pnl = projectPnl(p003, assignments, employees, grades);
    expect(pnl.assignedCost).toBe(6400);
    expect(pnl.margin).toBe(-400);
    expect(pnl.marginRate).toBeLessThan(0);
    expect(pnl.marginRate).toBeCloseTo(-0.0667, 3);
  });

  // Boundary: 배정 0건 프로젝트 → 배정원가합 0·마진 = 수주 전액
  it('Boundary: 배정 0건 → 원가 0, 마진 = 수주 전액', () => {
    const empty: Project = {
      code: 'P-EMPTY',
      name: '빈 프로젝트',
      client: 'X',
      contractAmount: 5000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    const pnl = projectPnl(empty, assignments, employees, grades);
    expect(pnl.assignedCost).toBe(0);
    expect(pnl.margin).toBe(5000);
    expect(pnl.marginRate).toBe(1);
  });

  // Boundary: 수주 0 → 0 나눗셈 안전 (marginRate 0)
  it('Boundary: 수주 0 → marginRate 0 (0 나눗셈 안전)', () => {
    const zero: Project = {
      code: 'P-ZERO',
      name: '무수주',
      client: 'X',
      contractAmount: 0,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    const pnl = projectPnl(zero, [], employees, grades);
    expect(pnl.marginRate).toBe(0);
    expect(Number.isNaN(pnl.marginRate)).toBe(false);
  });

  // Inverse: margin = 수주 − 원가합 ↔ 원가합 = 수주 − margin
  it('Inverse: 원가합 = 수주 − 마진 역산 일치', () => {
    const pnl = projectPnl(p001, assignments, employees, grades);
    expect(pnl.revenue - pnl.margin).toBe(pnl.assignedCost);
  });

  // Reference: 참조 조인 (assignment → employee → grade) 올바른 해석
  it('Reference: E-01(고급)·E-02(중급)·E-04(초급) 참조 조인 정확', () => {
    const pnl = projectPnl(p001, assignments, employees, grades);
    // 4320 + 2080 + 1520 = 7920
    expect(pnl.assignedCost).toBe(4320 + 2080 + 1520);
  });

  // Existence: 참조 없는 등급을 가진 직원 배정 → 크래시 없음, 0 처리
  it('Existence: 참조 깨진 배정(없는 gradeId) → 예외 없이 0 원가', () => {
    const brokenEmp: Employee = { id: 'E-X', name: '유령', gradeId: 'G-NONE' };
    const brokenAssign: Assignment = { projectCode: 'P-BRK', employeeId: 'E-X', mm: 5 };
    const proj: Project = {
      code: 'P-BRK',
      name: '깨진 참조',
      client: 'X',
      contractAmount: 3000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    };
    const pnl = projectPnl(proj, [brokenAssign], [brokenEmp], grades);
    expect(pnl.assignedCost).toBe(0);
    expect(pnl.margin).toBe(3000);
    expect(Number.isNaN(pnl.marginRate)).toBe(false);
  });
});

// ─── portfolioRollup ─────────────────────────────────────────────────────────

describe('portfolioRollup', () => {
  // Right: 전사 합계 정확값
  it('Right: 전사 합계 = 수주 29200, 원가 19520, 마진 9680', () => {
    const roll = portfolioRollup(projects, assignments, employees, grades);
    expect(roll.totalRevenue).toBe(29200);
    expect(roll.totalCost).toBe(19520);
    expect(roll.totalMargin).toBe(9680);
    expect(roll.marginRate).toBeCloseTo(9680 / 29200, 4);
  });

  // Cross-check: 전사 마진 = Σ 개별 projectPnl.margin
  it('Cross-check: 전사 마진 = 개별 프로젝트 마진의 단순 합', () => {
    const roll = portfolioRollup(projects, assignments, employees, grades);
    const sumOfMargins = projects
      .map((p) => projectPnl(p, assignments, employees, grades).margin)
      .reduce((s, m) => s + m, 0);
    expect(roll.totalMargin).toBe(sumOfMargins);
  });

  // Cardinality: 프로젝트 0건 → 전부 0, 나눗셈 안전
  it('Cardinality: 프로젝트 0건 → 합계 전부 0, marginRate 0', () => {
    const roll = portfolioRollup([], assignments, employees, grades);
    expect(roll.totalRevenue).toBe(0);
    expect(roll.totalCost).toBe(0);
    expect(roll.totalMargin).toBe(0);
    expect(roll.marginRate).toBe(0);
  });

  // Cardinality: 프로젝트 1건 → 집계 = 그 값
  it('Cardinality: 프로젝트 1건 → 집계 = 그 프로젝트 손익', () => {
    const p001 = projects.find((p) => p.code === 'P-001')!;
    const roll = portfolioRollup([p001], assignments, employees, grades);
    const single = projectPnl(p001, assignments, employees, grades);
    expect(roll.totalRevenue).toBe(single.revenue);
    expect(roll.totalMargin).toBe(single.margin);
  });
});

// ─── format ─────────────────────────────────────────────────────────────────

describe('formatAmount (Conformance)', () => {
  it('15000만 → "1.5억"', () => {
    expect(formatAmount(15000)).toBe('1.5억');
  });
  it('8200만 → "8,200만"', () => {
    expect(formatAmount(8200)).toBe('8,200만');
  });
  it('10000만 → "1억" (정수 억)', () => {
    expect(formatAmount(10000)).toBe('1억');
  });
});

describe('formatPercent (Conformance)', () => {
  it('0.472 → "47.2%"', () => {
    expect(formatPercent(0.472)).toBe('47.2%');
  });
  it('음수: -0.067 → "-6.7%"', () => {
    expect(formatPercent(-0.067)).toBe('-6.7%');
  });
});

// ─── marginSignal (Range — 경계값 분류) ───────────────────────────────────────

describe('marginSignal (Range 경계값)', () => {
  it('0.30 → ok (경계 포함)', () => {
    expect(marginSignal(0.3).level).toBe('ok');
  });
  it('0.2999 → watch (0.30 미만)', () => {
    expect(marginSignal(0.2999).level).toBe('watch');
  });
  it('0.15 → watch (경계 포함)', () => {
    expect(marginSignal(0.15).level).toBe('watch');
  });
  it('0.1499 → risk (0.15 미만)', () => {
    expect(marginSignal(0.1499).level).toBe('risk');
  });
  it('음수 → risk', () => {
    expect(marginSignal(-0.067).level).toBe('risk');
  });
  it('실데이터 마진율 → 신호 매핑: P-001 ok, P-003 risk', () => {
    const p001 = projectPnl(projects[0], assignments, employees, grades);
    const p003 = projectPnl(projects[2], assignments, employees, grades);
    expect(marginSignal(p001.marginRate).level).toBe('ok');
    expect(marginSignal(p003.marginRate).level).toBe('risk');
  });
});

// ─── Ordering (마진율 오름차순 → 적자 최상단) ─────────────────────────────────

describe('Ordering', () => {
  it('마진율 오름차순 정렬 시 적자 P-003 최상단', () => {
    const sorted = projects
      .map((p) => projectPnl(p, assignments, employees, grades))
      .sort((a, b) => a.marginRate - b.marginRate);
    expect(sorted[0].code).toBe('P-003');
  });
});

// ─── Existence (없는 프로젝트 code 안전 처리) ─────────────────────────────────

describe('Existence', () => {
  it('없는 project code → find undefined (크래시 없음)', () => {
    const found = projects.find((p) => p.code === 'P-XXX');
    expect(found).toBeUndefined();
  });
});
