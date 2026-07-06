/**
 * 배정 편집 인메모리 store
 *
 * 무영속 데모 store — 페이지 리로드 시 목업 초기값으로 복원됨.
 * 서버 저장 없음.
 */

import { writable } from 'svelte/store';
import { assignments as initialAssignments } from '$lib/data/mock';
import type { Assignment } from '$lib/types';

/** 배정 목록 store (초기값 = 목업 복제) */
export const assignments = writable<Assignment[]>([...initialAssignments]);

/** 새 배정 추가 */
export function addAssignment(a: Assignment): void {
  assignments.update((list) => [...list, a]);
}

/**
 * 인덱스 기반 배정 수정
 * @param index - 수정할 배정의 인덱스
 * @param patch - 변경할 필드 (Partial<Assignment>)
 */
export function updateAssignment(index: number, patch: Partial<Assignment>): void {
  assignments.update((list) =>
    list.map((item, i) => (i === index ? { ...item, ...patch } : item))
  );
}

/** 인덱스 기반 배정 제거 */
export function removeAssignment(index: number): void {
  assignments.update((list) => list.filter((_, i) => i !== index));
}

/** 배정 목록을 목업 초기값으로 복원 */
export function resetAssignments(): void {
  assignments.set([...initialAssignments]);
}
