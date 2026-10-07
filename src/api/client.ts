/**
 * 데이터 접근 계층.
 *
 * 화면은 이 파일의 함수만 부른다. 지금은 src/mock 의 가상 데이터를 돌려주고,
 * API 서버가 준비되면 "이 파일 내부만" fetch 로 바꾸면 된다. 함수 이름·인자·반환 타입은 유지한다.
 *
 * 교체 예시:
 *   export async function getRegions(): Promise<Region[]> {
 *     const res = await fetch(`${API_BASE}/regions`);
 *     if (!res.ok) throw new Error(`지역 목록 요청 실패: ${res.status}`);
 *     return res.json();
 *   }
 */

import type {
  DispatchCriteria,
  DispatchResult,
  EmissionAssumptions,
  EmissionFactor,
  Hospital,
  Region,
  ReservationSlot,
} from './types';
import { regions } from '../mock/regions';
import { hospitals } from '../mock/hospitals';
import { reservations, RESERVATION_DATE } from '../mock/reservations';
import { emissionFactors } from '../mock/emissionFactors';
import { AVG_SPEED_KMH, ROAD_FACTOR, hospitalPoints, regionPoints } from '../mock/geo';
import { simulateDispatch as runGreedy } from '../lib/dispatch';

/** API 연동 시 사용할 주소. 예: import.meta.env.VITE_API_BASE */
// const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

/** 목 데이터도 비동기로 돌려준다. fetch 로 바꿔도 화면 코드가 그대로 동작하도록. */
const resolve = <T>(value: T): Promise<T> => Promise.resolve(structuredClone(value));

/** 경기도 읍·면·동 목록 (취약도 포함). API: GET /regions */
export function getRegions(): Promise<Region[]> {
  return resolve(regions);
}

/** 지역 하나의 상세. API: GET /regions/{id} */
export function getRegionDetail(id: string): Promise<Region> {
  const found = regions.find((r) => r.id === id);
  return found ? resolve(found) : Promise.reject(new Error(`지역을 찾을 수 없음: ${id}`));
}

/** 병원 목록. API: GET /hospitals */
export function getHospitals(): Promise<Hospital[]> {
  return resolve(hospitals);
}

/** 시뮬레이션 기준 날짜(목 데이터에 있는 날짜). API 연동 시 날짜 선택 UI로 대체 가능 */
export function getDefaultReservationDate(): Promise<string> {
  return resolve(RESERVATION_DATE);
}

/**
 * 하루치 익명 예약 슬롯. API: GET /reservations?date=YYYY-MM-DD[&hospitalId=]
 * 개인 식별 정보 없이 마을·시간대·인원만 온다.
 */
export function getReservations(params: { date: string; hospitalId?: string }): Promise<ReservationSlot[]> {
  return resolve(
    reservations.filter(
      (r) => r.date === params.date && (!params.hospitalId || r.hospitalId === params.hospitalId),
    ),
  );
}

/** 배출계수. API: GET /emission-factors */
export function getEmissionFactors(): Promise<EmissionFactor[]> {
  return resolve(emissionFactors);
}

/**
 * 공동배차 시뮬레이션. API: POST /dispatch/simulate  { date, criteria, assumptions }
 * 지금은 브라우저에서 그리디 묶기(src/lib/dispatch.ts)를 돌린다.
 * 서버가 경로 API 기반 거리로 계산하게 되면 이 함수 내부만 fetch 로 바꾼다.
 */
export async function simulateDispatch(
  date: string,
  criteria: DispatchCriteria,
  assumptions: EmissionAssumptions,
): Promise<DispatchResult> {
  const slots = await getReservations({ date });
  const point = (id: string) => regionPoints[id] ?? hospitalPoints[id];
  const factor = (id: EmissionFactor['id']) => emissionFactors.find((f) => f.id === id)!.kgPerKm;

  const { dispatched, heldBack } = runGreedy(slots, criteria, {
    distanceKm: (a, b) => {
      const [ax, ay] = point(a);
      const [bx, by] = point(b);
      return Math.hypot(ax - bx, ay - by) * ROAD_FACTOR;
    },
    speedKmh: AVG_SPEED_KMH,
    carKgPerKm: factor('car_gasoline'),
    vanKgPerKm: factor(assumptions.vanFactorId),
    conversionRate: assumptions.conversionRate,
  });
  return { date, criteria, dispatched, heldBack };
}
