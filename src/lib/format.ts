/**
 * PSA 포맷·신호등 유틸
 *
 * 단위 규약:
 *   formatAmount  — 입력: 만원 단위 정수/실수
 *                   출력: 억/만원 축약 문자열 (예: 15000 → "1.5억", 8200 → "8,200만")
 *   formatPercent — 입력: 0~1 비율 (pnl.ts marginRate와 동일 규약)
 *                   출력: 소수점 1자리 퍼센트 문자열 (예: 0.472 → "47.2%")
 *   marginSignal  — 입력: 0~1 비율 (marginRate)
 *                   임계값: ≥0.30 ok / ≥0.15 watch / <0.15 risk
 *                   DESIGN.md 토큰 기반 color 값 사용
 */

// ─── 금액 축약 ─────────────────────────────────────────────────────────────────

/**
 * 만원 단위 금액을 억/만원 축약 문자열로 변환.
 *
 * 10,000만 이상 → 억 단위 (소수점 1자리)
 * 10,000만 미만 → 만원 단위 (천 단위 콤마)
 *
 * @param v 금액 (단위: 만원)
 */
export function formatAmount(v: number): string {
  if (v >= 10000) {
    const oku = v / 10000;
    // 소수점이 0이면 정수 표기
    const formatted = oku % 1 === 0 ? oku.toFixed(0) : oku.toFixed(1);
    return `${formatted}억`;
  }
  // 만원 단위 — 천 단위 콤마
  return `${Math.round(v).toLocaleString('ko-KR')}만`;
}

// ─── 퍼센트 ────────────────────────────────────────────────────────────────────

/**
 * 0~1 비율을 퍼센트 문자열로 변환.
 * 음수(적자) 포함 처리.
 *
 * @param v 비율 (0~1, 음수 가능)
 * @example formatPercent(0.472) → "47.2%"
 * @example formatPercent(-0.067) → "-6.7%"
 */
export function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

// ─── 마진 신호등 ───────────────────────────────────────────────────────────────

export type MarginLevel = 'ok' | 'watch' | 'risk';

export interface MarginSignal {
  level: MarginLevel;
  /** DESIGN.md 토큰 기반 hex 색상 */
  color: string;
  emoji: string;
}

/**
 * 마진율 기반 신호등 반환.
 *
 * 임계값 (입력: 0~1 비율):
 *   ≥ 0.30  → ok    (#16A34A, --health-ok)   🟢
 *   ≥ 0.15  → watch (#D97706, --health-watch) 🟡
 *   < 0.15  → risk  (#DC2626, --health-risk)  🔴
 *
 * 경계 포함 규칙: 0.30 이상이면 ok, 0.15 이상이면 watch, 미만은 risk.
 *
 * @param rate marginRate (0~1 비율, 음수 가능)
 */
export function marginSignal(rate: number): MarginSignal {
  if (rate >= 0.30) {
    return { level: 'ok',    color: '#16A34A', emoji: '🟢' };
  }
  if (rate >= 0.15) {
    return { level: 'watch', color: '#D97706', emoji: '🟡' };
  }
  return   { level: 'risk',  color: '#DC2626', emoji: '🔴' };
}
