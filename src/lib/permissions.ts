/**
 * permissions.ts — 대시보드·손익 화면 공유 권한 마스킹 유틸리티
 *
 * 권한 매트릭스는 미확정(윗선 결정) — 데모용 플레이스홀더
 */

import { writable } from 'svelte/store';

// ──────────────────────────────────────────────
// Role 타입 및 스토어
// ──────────────────────────────────────────────

export type Role = 'admin' | 'pm' | 'viewer';

/** 데모용 role 전환 지원 — 초기값 'viewer' */
export const currentRole = writable<Role>('viewer');

// ──────────────────────────────────────────────
// 민감 지표 타입
// ──────────────────────────────────────────────

export type SensitiveMetric = '마진' | '손익' | '인건원가' | '인당수익';

// ──────────────────────────────────────────────
// 권한 매트릭스 (플레이스홀더 — 미확정)
//
// 구조: PERMISSION_MATRIX[role][metric] = boolean
// 실제 정책 확정 시 이 객체만 수정하면 된다.
// ──────────────────────────────────────────────

const PERMISSION_MATRIX: Record<Role, Record<SensitiveMetric, boolean>> = {
  admin: {
    마진: true,
    손익: true,
    인건원가: true,
    인당수익: true,
  },
  pm: {
    마진: true,
    손익: true,
    인건원가: true,
    인당수익: false,
  },
  viewer: {
    마진: false,
    손익: false,
    인건원가: false,
    인당수익: false,
  },
};

// ──────────────────────────────────────────────
// 공개 함수
// ──────────────────────────────────────────────

/**
 * 해당 role이 지표를 열람할 수 있는지 반환한다.
 *
 * @param metric - 민감 지표 종류
 * @param role   - 현재 사용자 role
 * @returns 열람 허용 여부
 */
export function canView(metric: SensitiveMetric, role: Role): boolean {
  return PERMISSION_MATRIX[role][metric];
}

/**
 * 허용 여부에 따라 값을 표시 문자열 또는 잠금 표기로 반환한다.
 *
 * - allowed === true  → String(value) 반환 (원값의 문자열 표현)
 * - allowed === false → placeholder (기본: '🔒 권한 제한') 반환
 *
 * 색 강조 없음 — 텍스트·아이콘 표기만 사용한다.
 *
 * @param value       - 원본 값
 * @param allowed     - canView() 결과
 * @param placeholder - 잠금 시 표시 문자열 (기본값: '🔒 권한 제한')
 * @returns 표시용 문자열
 */
export function maskValue<T>(
  value: T,
  allowed: boolean,
  placeholder: string = '🔒 권한 제한',
): string {
  if (allowed) {
    return String(value);
  }
  return placeholder;
}
