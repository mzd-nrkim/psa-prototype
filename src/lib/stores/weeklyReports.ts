/**
 * 주간보고 인메모리 store
 *
 * 무영속 데모 store — 페이지 리로드 시 목업 초기값으로 복원됨.
 * 서버 저장 없음.
 */

import { writable, derived } from 'svelte/store';
import { weeklyReports as initialReports } from '$lib/data/mock';
import type { WeeklyReport } from '$lib/types';

/** 주간보고 목록 store (초기값 = 목업 복제) */
export const weeklyReports = writable<WeeklyReport[]>([...initialReports]);

/** 새 주간보고 추가 */
export function addWeeklyReport(r: WeeklyReport): void {
  weeklyReports.update((list) => [...list, r]);
}

/**
 * 특정 프로젝트의 주간보고를 주차 오름차순으로 반환하는 derived store 생성 헬퍼.
 *
 * 사용 예:
 *   const p001Reports = reportsForProject('P-001');
 *   // $p001Reports → WeeklyReport[] (주차순 정렬)
 *
 * @param code - 조회할 프로젝트 코드 (예: 'P-001')
 */
export function reportsForProject(code: string) {
  return derived(weeklyReports, ($reports) =>
    $reports
      .filter((r) => r.projectCode === code)
      .sort((a, b) => a.week.localeCompare(b.week))
  );
}
