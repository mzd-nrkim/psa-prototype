/**
 * PSA 전사 포트폴리오 롤업·가동 집계 — 순수 함수
 *
 * 단위 규약:
 *   - 금액: 만원
 *   - rate: 0~1 비율
 *   - mm: man-month
 */

import type { Project, Assignment, Employee, Grade } from './types.js';
import { portfolioRollup, projectPnl } from './pnl.js';
import { projectHealth } from './health.js';

// ─── 상수 ─────────────────────────────────────────────────────────────────────

/** 인당 기준 투입 M/M (벤치 기회비용 산출에 사용) */
export const STANDARD_CAPACITY_MM = 6;

// ─── 반환 타입 ────────────────────────────────────────────────────────────────

export interface PortfolioSummary {
  /** lifecycle '진행' 또는 lifecycle 미설정 프로젝트 수 */
  activeCount: number;
  /** grade '위험' 프로젝트 수 */
  riskCount: number;
  /** 전체 수주 합계 (만원) */
  totalContract: number;
  /** 전사 마진율 (0~1 비율) */
  marginRate: number;
}

export interface HealthGradeCounts {
  정상: number;
  주의: number;
  위험: number;
}

export interface UtilizationSummary {
  /** 프로젝트에 배정된 직원 수 */
  assignedCount: number;
  /** 미배정(벤치) 직원 수 */
  benchCount: number;
  /** 가동률 = assignedCount / 전체 (0~1 비율) */
  utilizationRate: number;
  /** 벤치 직원 기대 인건비 합계 (standardCost × STANDARD_CAPACITY_MM, 만원) */
  expectedBenchCost: number;
  /** 벤치 비율 = benchCount / 전체 (0~1 비율) */
  unassignedRatio: number;
}

// ─── 함수 ─────────────────────────────────────────────────────────────────────

/**
 * 전사 포트폴리오 요약.
 *
 * activeCount: lifecycle '진행' 또는 undefined 프로젝트만 카운트.
 * riskCount: 전 프로젝트 중 grade '위험' 프로젝트 수.
 */
export function portfolioSummary(
  projects: Project[],
  assignments: Assignment[],
  employees: Employee[],
  grades: Grade[],
): PortfolioSummary {
  const rollup = portfolioRollup(projects, assignments, employees, grades);

  const activeCount = projects.filter(
    (p) => p.lifecycle === '진행' || p.lifecycle === undefined,
  ).length;

  const riskCount = projects.filter((p) => {
    const pnl = projectPnl(p, assignments, employees, grades);
    return projectHealth(p, pnl).grade === '위험';
  }).length;

  const totalContract = projects.reduce((sum, p) => sum + p.contractAmount, 0);

  return { activeCount, riskCount, totalContract, marginRate: rollup.marginRate };
}

/**
 * 전 프로젝트의 헬스 등급별 집계.
 */
export function healthGradeCounts(
  projects: Project[],
  assignments: Assignment[],
  employees: Employee[],
  grades: Grade[],
): HealthGradeCounts {
  const counts: HealthGradeCounts = { 정상: 0, 주의: 0, 위험: 0 };

  for (const project of projects) {
    const pnl = projectPnl(project, assignments, employees, grades);
    const health = projectHealth(project, pnl);
    counts[health.grade]++;
  }

  return counts;
}

/**
 * 인력 가동 현황.
 *
 * @param employees   전체 직원 배열
 * @param assignments 전체 배정 배열 (어떤 프로젝트든 1건이라도 배정이면 '가동' 판정)
 * @param grades      등급 배열 (벤치 기대비용 산출에 필요)
 */
export function utilizationSummary(
  employees: Employee[],
  assignments: Assignment[],
  grades: Grade[],
): UtilizationSummary {
  const total = employees.length;
  if (total === 0) {
    return {
      assignedCount: 0,
      benchCount: 0,
      utilizationRate: 0,
      expectedBenchCost: 0,
      unassignedRatio: 0,
    };
  }

  const assignedIds = new Set(assignments.map((a) => a.employeeId));
  const assignedCount = employees.filter((e) => assignedIds.has(e.id)).length;
  const benchCount = total - assignedCount;

  const utilizationRate = assignedCount / total;
  const unassignedRatio = benchCount / total;

  // 벤치 직원 기대 인건비: standardCost × STANDARD_CAPACITY_MM
  const gradeMap = new Map<string, Grade>(grades.map((g) => [g.id, g]));
  const expectedBenchCost = employees
    .filter((e) => !assignedIds.has(e.id))
    .reduce((sum, e) => {
      const grade = gradeMap.get(e.gradeId);
      return sum + (grade ? grade.standardCost * STANDARD_CAPACITY_MM : 0);
    }, 0);

  return { assignedCount, benchCount, utilizationRate, expectedBenchCost, unassignedRatio };
}
