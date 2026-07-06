/**
 * PSA 인당 수익 산정 — 순수 함수
 *
 * 산정 방법론 (플레이스홀더):
 *   인당 기여 = 해당 직원이 배정된 모든 배정의 (청구단가 − 표준원가) × M/M 합산
 *   billRate·standardCost 는 employee.gradeId → Grade 에서 조회.
 *
 * TODO(플레이스홀더): 방법론 미확정.
 *   현재는 "(청구단가−표준원가)×M/M" 스프레드 방식을 사용하나,
 *   실제 운영 시 "프로젝트 마진의 원가 비중 배분" 방식으로 교체 가능.
 *   산정식 변경 시 formula 반환 문자열도 함께 갱신할 것.
 *
 * 단위 규약:
 *   - value: 만원
 *   - mm: man-month
 */

import type { Assignment, Employee, Grade, Project } from './types.js';

/**
 * 특정 직원의 인당 기여 금액과 산정식 문자열을 반환.
 *
 * @param employee    대상 직원
 * @param assignments 전체 배정 배열 — 내부에서 employee.id 로 필터
 * @param employees   전체 직원 배열 (확장 대비 — 팀 배분 방식 전환 시 사용)
 * @param grades      전체 등급 배열 — gradeId → Grade 조회용
 * @param projects    전체 프로젝트 배열 (확장 대비 — 프로젝트 마진 배분 방식 전환 시 사용)
 * @returns { value: 만원, formula: 화면 표기용 산정식 문자열 }
 */
export function perHeadContribution(
  employee: Employee,
  assignments: Assignment[],
  employees: Employee[],
  grades: Grade[],
  projects: Project[],
): { value: number; formula: string } {
  const gradeMap = new Map<string, Grade>(grades.map((g) => [g.id, g]));
  const grade = gradeMap.get(employee.gradeId);

  // 해당 직원 배정만 필터
  const myAssignments = assignments.filter((a) => a.employeeId === employee.id);

  // Σ(청구단가 − 표준원가) × mm
  const value = myAssignments.reduce((sum, a) => {
    const spread = grade ? grade.billRate - grade.standardCost : 0;
    return sum + spread * a.mm;
  }, 0);

  const formula = 'Σ(청구단가−표준원가)×M/M';

  return { value, formula };
}
