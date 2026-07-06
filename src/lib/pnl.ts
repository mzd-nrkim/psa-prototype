/**
 * PSA 손익 파생 계산 — 순수 함수 모음
 *
 * 단위 규약:
 *   - 금액: 만원 (Grade.standardCost, Project.contractAmount 등)
 *   - marginRate: 0~1 비율 (예: 0.472 = 47.2%)
 *   - mm: man-month (소수점 허용)
 *
 * projectPnl 시그니처 선택:
 *   allAssignments(전체 배열)를 받아 내부에서 projectCode로 필터한다.
 *   employees 배열도 받아 employeeId → gradeId → Grade 로 조회한다.
 */

import type { Assignment, Employee, Grade, GradeRate, Project, ProjectPnL } from './types.js';

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

/** grade 없으면 0 반환 (무음 NaN 방지) */
export function assignmentCost(assignment: Assignment, grade: Grade | undefined): number {
  if (!grade) return 0;
  return grade.standardCost * assignment.mm;
}

// ─── 단일 프로젝트 손익 ────────────────────────────────────────────────────────

/**
 * 프로젝트 손익 계산.
 *
 * @param project       대상 프로젝트
 * @param allAssignments 전체 배정 배열 — 내부에서 project.code 로 필터
 * @param employees     전체 직원 배열 — employeeId → gradeId 조회용
 * @param grades        전체 등급 배열 — gradeId → Grade 조회용
 * @returns ProjectPnL  marginRate 단위: 0~1 비율
 */
export function projectPnl(
  project: Project,
  allAssignments: Assignment[],
  employees: Employee[],
  grades: Grade[],
): ProjectPnL {
  // 등급 Map (빠른 조회)
  const gradeMap = new Map<string, Grade>(grades.map((g) => [g.id, g]));
  // 직원 Map
  const employeeMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));

  // 해당 프로젝트 배정만 필터
  const projectAssignments = allAssignments.filter((a) => a.projectCode === project.code);

  // 배정 원가 합산 (없는 employee/grade → 0, NaN 오염 없음)
  const assignedCost = projectAssignments.reduce((sum, a) => {
    const emp = employeeMap.get(a.employeeId);
    const grade = emp ? gradeMap.get(emp.gradeId) : undefined;
    return sum + assignmentCost(a, grade);
  }, 0);

  const revenue = project.contractAmount;
  const margin = revenue - assignedCost;
  // 0 나눗셈 안전 처리
  const marginRate = revenue > 0 ? margin / revenue : 0;

  return { code: project.code, revenue, assignedCost, margin, marginRate };
}

// ─── 전사 포트폴리오 롤업 ──────────────────────────────────────────────────────

/**
 * 전체 프로젝트 합산 손익.
 *
 * @returns marginRate 단위: 0~1 비율
 */
export function portfolioRollup(
  projects: Project[],
  assignments: Assignment[],
  employees: Employee[],
  grades: Grade[],
): { totalRevenue: number; totalCost: number; totalMargin: number; marginRate: number } {
  const pnls = projects.map((p) => projectPnl(p, assignments, employees, grades));

  const totalRevenue = pnls.reduce((s, p) => s + p.revenue, 0);
  const totalCost = pnls.reduce((s, p) => s + p.assignedCost, 0);
  const totalMargin = totalRevenue - totalCost;
  // 0 나눗셈 안전 처리
  const marginRate = totalRevenue > 0 ? totalMargin / totalRevenue : 0;

  return { totalRevenue, totalCost, totalMargin, marginRate };
}

// ─── 시점단가 기반 원가 ────────────────────────────────────────────────────────

/**
 * 시점단가 기반 배정 원가.
 *
 * 배정의 등급(assignment.assignedGradeId ?? employee.gradeId) 와
 * assignment.startDate 를 기준으로 유효한 GradeRate 를 찾아
 * standardCost × mm 를 반환한다.
 *
 * GradeRate 없거나 startDate 없으면 grades[].standardCost 로 폴백 (무음 NaN 금지, 없으면 0).
 */
export function assignmentCostAtTime(
  assignment: Assignment,
  employees: Employee[],
  grades: Grade[],
  gradeRates: GradeRate[],
): number {
  const gradeId =
    assignment.assignedGradeId ??
    employees.find((e) => e.id === assignment.employeeId)?.gradeId;

  if (!gradeId) return 0;

  let standardCost: number | undefined;

  if (assignment.startDate) {
    const date = assignment.startDate;
    const rate = gradeRates.find(
      (r) =>
        r.gradeId === gradeId &&
        r.validFrom <= date &&
        (r.validTo === null || date <= r.validTo),
    );
    standardCost = rate?.standardCost;
  }

  if (standardCost === undefined) {
    // 폴백: grades[].standardCost (startDate 없거나 GradeRate 미매칭 시)
    standardCost = grades.find((g) => g.id === gradeId)?.standardCost;
  }

  return (standardCost ?? 0) * assignment.mm;
}

/** 원가 비중 (0~1 비율). totalCost > 0 보장, 0 나눗셈 안전 처리. */
export function costShare(cost: number, totalCost: number): number {
  return totalCost > 0 ? cost / totalCost : 0;
}
