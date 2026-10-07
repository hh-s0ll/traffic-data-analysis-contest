// 탄소 손익분기 계산. 화면 3(차량별 비교)과 화면 4(손익분기 곡선), 개요가 함께 쓴다.
//
// 기획안 5장 계산식에 "차량 전환율"을 반영한다.
//   승용차 대체 배출 = 인원 × 차량 전환율 × 병원 왕복거리 × 승용차 배출계수
//   공동배차 배출   = (마을 경유 거리 + 병원 왕복거리) × 우회계수 × 승합차 배출계수
//   최소 합승 인원   = 공동배차 배출이 승용차 대체 배출보다 "작아지는" 가장 작은 정수 인원
//
// 차량 전환율: 똑버스 탑승자 중 원래 승용차로 갔을 사람의 비율.
// 전원이 원래 승용차를 탔다고 가정하면 감축 효과를 부풀리게 되므로, 이 비율만큼만 승용차 배출을 줄인 것으로 본다.

import type { EmissionComparison } from '../api/types';

export interface BreakEvenInput {
  oneWayKm: number; // 마을에서 병원까지 편도 거리
  villageKm: number; // 마을 사이를 돌며 태우는 추가 거리
  detourFactor: number; // 우회계수 (1 이상)
  conversionRate: number; // 차량 전환율 (0~1)
  carKgPerKm: number;
  vanKgPerKm: number;
}

/** 합승 인원 중 원래 승용차로 갔을 사람들의 배출 (공동배차로 대체되는 양) */
export function carEmissionKg(passengers: number, i: BreakEvenInput) {
  return passengers * i.conversionRate * 2 * i.oneWayKm * i.carKgPerKm;
}

export function drtEmissionKg(i: BreakEvenInput) {
  return (i.villageKm + 2 * i.oneWayKm) * i.detourFactor * i.vanKgPerKm;
}

/** 두 선이 만나는 지점(소수 인원) */
export function crossingPoint(i: BreakEvenInput) {
  return drtEmissionKg(i) / carEmissionKg(1, i);
}

/** 최소 합승 인원: 1인당 승용차 대체 배출 × 인원 이 공동배차 배출보다 엄격히 커지는 첫 정수 */
export function breakEvenFrom(drtKg: number, carKgPerPerson: number) {
  if (carKgPerPerson <= 0) return Infinity;
  return Math.floor(drtKg / carKgPerPerson) + 1;
}

export function compare(passengers: number, i: BreakEvenInput): EmissionComparison {
  const drt = drtEmissionKg(i);
  return {
    carEmissionKg: carEmissionKg(passengers, i),
    drtEmissionKg: drt,
    breakEvenPassengers: breakEvenFrom(drt, carEmissionKg(1, i)),
  };
}

/**
 * 차량 전환율 시나리오 (기획안 5장: 보수·기본·적극 세 시나리오로 민감도 확인).
 * 보수 21.3%만 근거가 있고, 기본·적극은 임시값이다. 팀 확정 후 provisional 을 false 로 바꾼다.
 */
export interface Scenario {
  id: 'conservative' | 'base' | 'active';
  label: string;
  conversionRate: number;
  basis: string; // 근거 또는 가정 설명
  provisional: boolean; // true 면 화면에 "임시값" 표시
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'conservative',
    label: '보수',
    conversionRate: 0.213,
    basis:
      '수원시정연구원 똑버스 이용자 조사에서 도입 전 자가용을 주로 이용했다는 응답 21.3%. 도시 지역 조사라 농촌에서는 낮게 잡은 값',
    provisional: false,
  },
  {
    id: 'base',
    label: '기본',
    conversionRate: 0.4,
    basis: '농촌 고령자는 자가용 의존이 더 크다는 가정. 임시값이며 팀 확정 필요',
    provisional: true,
  },
  {
    id: 'active',
    label: '적극',
    conversionRate: 0.6,
    basis: '취약지역 이용자 대부분이 원래 자가용으로 병원에 갔다는 가정. 임시값이며 팀 확정 필요',
    provisional: true,
  },
];

/** 운영 가정 기본값 (시나리오와 무관하게 화면 4에서 조절) */
export const DEFAULT_ONE_WAY_KM = 15;
export const DEFAULT_DETOUR = 1.25;
export const DEFAULT_VILLAGE_KM = 8;
