/**
 * PSA 데이터 모델 타입 정의
 *
 * 금액 단위 규약: 모든 금액 필드는 **만원(KRW 10,000)** 단위.
 *   예: contractAmount=15000 → 1억 5,000만 원
 *   예: standardCost=720 → 월 720만 원
 */

/** 등급 — 인건원가·청구단가 기준 단위 */
export interface Grade {
  /** 등급 ID (예: "G-03") */
  id: string;
  /** 등급명 (예: "고급") */
  name: string;
  /** 월 표준 인건원가 (단위: 만원/월) */
  standardCost: number;
  /** 월 청구단가 (단위: 만원/월) */
  billRate: number;
}

/** 직원 */
export interface Employee {
  id: string;
  name: string;
  /** 소속 등급 ID — Grade.id 참조 */
  gradeId: string;
}

/** 프로젝트 */
export interface Project {
  /** 프로젝트 코드 (예: "P-001") */
  code: string;
  name: string;
  /** 고객사명 (중립 익명, 예: "A제조") */
  client: string;
  /** 수주액 (단위: 만원) */
  contractAmount: number;
  /** 시작일 (ISO 8601, YYYY-MM-DD) */
  startDate: string;
  /** 종료일 (ISO 8601, YYYY-MM-DD) */
  endDate: string;
  /** 담당 PM 이름 */
  pm?: string;
  /** 프로젝트 생애주기 */
  lifecycle?: '제안' | '진행' | '완료' | '중단';
  /** 진척률 (0~100) */
  progressRate?: number;
  /** 계획 종료일 (ISO 8601, YYYY-MM-DD) */
  plannedEndDate?: string;
  /** 실제 종료일 (ISO 8601, YYYY-MM-DD) */
  actualEndDate?: string;
}

/** 투입 배정 — 직원 × 프로젝트 × M/M */
export interface Assignment {
  projectCode: string;
  employeeId: string;
  /** 투입 M/M (man-month, 소수점 허용) */
  mm: number;
}

/**
 * 프로젝트 손익 파생 뷰
 *
 * marginRate 단위: **0~1 비율** (예: 0.472 = 47.2%)
 * margin·revenue·assignedCost 단위: 만원
 */
export interface ProjectPnL {
  code: string;
  /** 매출 = contractAmount (만원) */
  revenue: number;
  /** 배정 원가 합계 (만원) */
  assignedCost: number;
  /** 마진 = revenue − assignedCost (만원) */
  margin: number;
  /** 마진율 = margin / revenue, 범위 −∞~1 (0~1 비율) */
  marginRate: number;
}

/** 주간 보고 */
export interface WeeklyReport {
  projectCode: string;
  /** ISO 주차 표기 (예: "2026-W26") */
  week: string;
  progressRate: number;
  issues: string;
  nextPlan: string;
}

/** 프로젝트 헬스 등급 */
export type HealthGrade = '정상' | '주의' | '위험';

/** 헬스 이상 사유 */
export type HealthReason = '저마진' | '일정지연' | '적자';

/** 프로젝트 헬스 종합 */
export interface ProjectHealth {
  grade: HealthGrade;
  reasons: HealthReason[];
}
