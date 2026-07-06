/**
 * PSA 프로젝트 헬스 종합 — 순수 함수
 *
 * 임계값 상수는 파일 상단에 모아 두어 쉽게 교체할 수 있도록 한다.
 * 금액 단위: 만원 / marginRate 단위: 0~1 비율
 */

import type { Project, ProjectPnL, ProjectHealth, HealthGrade, HealthReason } from './types.js';

// ─── 임계값 상수 ──────────────────────────────────────────────────────────────

/** 저마진 경고 임계값 (0~1 비율). marginRate 가 이 값 미만이면 '저마진' */
export const LOW_MARGIN_THRESHOLD = 0.15;

// ─── 헬스 종합 ────────────────────────────────────────────────────────────────

/**
 * 프로젝트 헬스 종합 판정.
 *
 * @param project 대상 프로젝트 (actualEndDate·plannedEndDate 는 optional)
 * @param pnl     projectPnl() 반환값
 * @returns ProjectHealth  grade·reasons 배열
 *
 * 판정 우선순위:
 *   - '적자' ∈ reasons → grade = '위험'
 *   - '저마진' 또는 '일정지연' ∈ reasons → grade = '주의'
 *   - reasons 비어 있음 → grade = '정상'
 */
export function projectHealth(project: Project, pnl: ProjectPnL): ProjectHealth {
  const reasons: HealthReason[] = [];

  // 적자: marginRate < 0
  if (pnl.marginRate < 0) {
    reasons.push('적자');
  }

  // 저마진: 0 ≤ marginRate < LOW_MARGIN_THRESHOLD
  if (pnl.marginRate >= 0 && pnl.marginRate < LOW_MARGIN_THRESHOLD) {
    reasons.push('저마진');
  }

  // 일정지연: actualEndDate > plannedEndDate (두 필드 모두 존재할 때만 비교)
  if (
    project.actualEndDate &&
    project.plannedEndDate &&
    project.actualEndDate > project.plannedEndDate
  ) {
    reasons.push('일정지연');
  }

  // 등급 결정
  let grade: HealthGrade;
  if (reasons.includes('적자')) {
    grade = '위험';
  } else if (reasons.includes('저마진') || reasons.includes('일정지연')) {
    grade = '주의';
  } else {
    grade = '정상';
  }

  return { grade, reasons };
}
