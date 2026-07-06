/**
 * PSA 목업 데이터
 *
 * 금액 단위 규약: 모든 금액 필드는 **만원(KRW 10,000)** 단위.
 *   standardCost/billRate: 만원/월
 *   contractAmount: 만원
 *
 * marginRate 단위: 0~1 비율 (pnl.ts 규약과 동일)
 *
 * ─────────────────────────────────────────────────────────────────────
 * 프로젝트별 마진 검산 (손 계산):
 *
 * [P-001] A제조 MES 고도화  수주 15,000만
 *   E-01(고급 720) × 6mm = 4,320
 *   E-02(중급 520) × 4mm = 2,080
 *   E-04(초급 380) × 4mm = 1,520
 *   assignedCost = 7,920 / margin = 7,080 / marginRate ≈ 0.472 (47.2%) 🟢
 *
 * [P-002] B금융 데이터플랫폼  수주 8,200만
 *   E-03(고급 720) × 4mm = 2,880
 *   E-05(중급 520) × 3mm = 1,560
 *   E-06(초급 380) × 2mm =   760
 *   assignedCost = 5,200 / margin = 3,000 / marginRate ≈ 0.366 (36.6%) 🟢
 *
 * [P-003] C유통 ERP 구축  수주 6,000만
 *   E-07(특급 980) × 4mm = 3,920
 *   E-01(고급 720) × 2mm = 1,440
 *   E-02(중급 520) × 2mm = 1,040
 *   assignedCost = 6,400 / margin = -400 / marginRate ≈ -0.067 (-6.7%) 🔴
 * ─────────────────────────────────────────────────────────────────────
 */

import type { Grade, Employee, Project, Assignment } from '../types.js';

// ─── 등급 (standardCost·billRate 단위: 만원/월) ─────────────────────────────
export const grades: Grade[] = [
  { id: 'G-01', name: '초급', standardCost: 380, billRate:  520 },
  { id: 'G-02', name: '중급', standardCost: 520, billRate:  720 },
  { id: 'G-03', name: '고급', standardCost: 720, billRate:  980 },
  { id: 'G-04', name: '특급', standardCost: 980, billRate: 1350 },
];

// ─── 직원 ────────────────────────────────────────────────────────────────────
export const employees: Employee[] = [
  { id: 'E-01', name: '김민준', gradeId: 'G-03' }, // 고급
  { id: 'E-02', name: '이서연', gradeId: 'G-02' }, // 중급
  { id: 'E-03', name: '박지훈', gradeId: 'G-03' }, // 고급
  { id: 'E-04', name: '최수아', gradeId: 'G-01' }, // 초급
  { id: 'E-05', name: '정도현', gradeId: 'G-02' }, // 중급
  { id: 'E-06', name: '강유진', gradeId: 'G-01' }, // 초급
  { id: 'E-07', name: '윤태양', gradeId: 'G-04' }, // 특급
];

// ─── 프로젝트 (contractAmount 단위: 만원) ────────────────────────────────────
export const projects: Project[] = [
  {
    code: 'P-001',
    name: 'A제조 MES 고도화',
    client: 'A제조',
    contractAmount: 15000,
    startDate: '2026-01-01',
    endDate: '2026-06-30',
  },
  {
    code: 'P-002',
    name: 'B금융 데이터플랫폼',
    client: 'B금융',
    contractAmount: 8200,
    startDate: '2026-02-01',
    endDate: '2026-07-31',
  },
  {
    code: 'P-003',
    name: 'C유통 ERP 구축',
    client: 'C유통',
    contractAmount: 6000,
    startDate: '2026-03-01',
    endDate: '2026-08-31',
  },
];

// ─── 배정 (mm: man-month) ────────────────────────────────────────────────────
// [P-001] A제조 — 마진율 47.2% 🟢 양호
// [P-002] B금융 — 마진율 36.6% 🟢 양호
// [P-003] C유통 — 마진율 -6.7% 🔴 적자
export const assignments: Assignment[] = [
  // P-001
  { projectCode: 'P-001', employeeId: 'E-01', mm: 6 },
  { projectCode: 'P-001', employeeId: 'E-02', mm: 4 },
  { projectCode: 'P-001', employeeId: 'E-04', mm: 4 },
  // P-002
  { projectCode: 'P-002', employeeId: 'E-03', mm: 4 },
  { projectCode: 'P-002', employeeId: 'E-05', mm: 3 },
  { projectCode: 'P-002', employeeId: 'E-06', mm: 2 },
  // P-003
  { projectCode: 'P-003', employeeId: 'E-07', mm: 4 },
  { projectCode: 'P-003', employeeId: 'E-01', mm: 2 },
  { projectCode: 'P-003', employeeId: 'E-02', mm: 2 },
];
