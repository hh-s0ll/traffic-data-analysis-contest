// 공동배차 묶기 (단순 그리디).
//
// 1. 같은 병원 예약을 시간대 순으로 정렬한다.
// 2. 묶음의 첫 예약을 기준으로 허용 대기시간 안에 들어오는 예약을 차례로 넣는다.
// 3. 정원을 넘으면 그 예약부터 새 차량(새 묶음)을 시작한다.
// 4. 최소 출발 인원에 못 미치는 묶음은 "선제 배차 안 함 (기존 호출형 유지)"으로 돌린다.
//
// 운행 가정
// - 차고지는 병원 옆. 병원 → 마을들 → 병원 순환 중 가장 짧은 순서로 돈다 (첫 마을까지는 빈 차)
// - 진료 후 같은 경로로 귀가시키므로 총 운행거리는 위 순환 거리의 2배
// - 첫 진료 10분 전 병원 도착, 정류장마다 2분 정차
// - 대기시간 = 병원 도착부터 그 차에 탄 사람 중 가장 늦은 진료 시각까지

import type { DispatchCriteria, DispatchPlan, ReservationSlot, VehiclePlan } from '../api/types';
import { breakEvenFrom } from './emission';
import { fromMinutes, toMinutes } from './format';

export const ARRIVAL_BUFFER_MIN = 10;
const DWELL_MIN = 2;

export interface DispatchEnv {
  /** 두 지점(마을 id 또는 병원 id) 사이 도로 거리(km) */
  distanceKm: (a: string, b: string) => number;
  speedKmh: number;
  carKgPerKm: number;
  vanKgPerKm: number;
  conversionRate: number; // 차량 전환율. 탑승자 중 이 비율만 원래 승용차로 갔다고 본다
}

type Bundle = { hospitalId: string; slots: ReservationSlot[]; passengers: number };

function bundleSlots(slots: ReservationSlot[], c: DispatchCriteria): Bundle[] {
  const byHospital = new Map<string, ReservationSlot[]>();
  for (const s of slots) {
    const list = byHospital.get(s.hospitalId) ?? [];
    list.push(s);
    byHospital.set(s.hospitalId, list);
  }

  const bundles: Bundle[] = [];
  for (const [hospitalId, list] of byHospital) {
    list.sort((a, b) => toMinutes(a.timeSlot) - toMinutes(b.timeSlot));
    let cur: Bundle | null = null;
    for (const s of list) {
      if (cur) {
        const wait = toMinutes(s.timeSlot) - toMinutes(cur.slots[0].timeSlot) + ARRIVAL_BUFFER_MIN;
        const fitsTime = wait <= c.maxWaitMinutes;
        const fitsSeat = cur.passengers + s.passengers <= c.vehicleCapacity;
        if (fitsTime && fitsSeat) {
          cur.slots.push(s);
          cur.passengers += s.passengers;
          continue;
        }
      }
      cur = { hospitalId, slots: [s], passengers: s.passengers };
      bundles.push(cur);
    }
  }
  return bundles;
}

/**
 * 병원 → 정류장들 → 병원 순환 거리가 가장 짧은 정차 순서.
 * 정류장 8곳 이하는 모든 순서를 다 따져 보고(최대 4만여 가지), 그보다 많으면 가까운 곳부터 잇는다.
 * 순환 방향은 병원에서 먼 쪽을 먼저 태우도록 고른다 (마지막 탑승자가 병원 가까이에 있게).
 */
function bestRoute(stops: string[], hospitalId: string, dist: DispatchEnv['distanceKm']): string[] {
  const loop = (p: string[]) =>
    dist(hospitalId, p[0]) +
    p.slice(1).reduce((sum, id, i) => sum + dist(p[i], id), 0) +
    dist(p[p.length - 1], hospitalId);

  let best: string[];
  if (stops.length <= 8) {
    best = stops;
    let bestKm = Infinity;
    const permute = (rest: string[], acc: string[]) => {
      if (rest.length === 0) {
        const km = loop(acc);
        if (km < bestKm) [best, bestKm] = [acc, km];
        return;
      }
      rest.forEach((id, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, id]));
    };
    permute(stops, []);
  } else {
    best = [];
    let cur = hospitalId;
    const left = new Set(stops);
    while (left.size) {
      const next = [...left].reduce((a, c) => (dist(cur, c) < dist(cur, a) ? c : a));
      best.push(next);
      left.delete(next);
      cur = next;
    }
  }
  const farFirst = dist(hospitalId, best[0]) >= dist(hospitalId, best[best.length - 1]);
  return farFirst ? best : [...best].reverse();
}

function toVehiclePlan(b: Bundle, vehicleId: string, env: DispatchEnv): VehiclePlan {
  // 같은 마을 예약은 한 정류장으로 합친다
  const perRegion = new Map<string, number>();
  for (const s of b.slots) perRegion.set(s.regionId, (perRegion.get(s.regionId) ?? 0) + s.passengers);

  const order = bestRoute([...perRegion.keys()], b.hospitalId, env.distanceKm);
  const lastIdx = order.length - 1;

  // 병원 도착 시각에서 거꾸로 각 정류장 탑승 시각을 계산한다
  const first = toMinutes(b.slots[0].timeSlot);
  const latest = toMinutes(b.slots[b.slots.length - 1].timeSlot);
  const arrival = first - ARRIVAL_BUFFER_MIN;
  const drive = (km: number) => (km / env.speedKmh) * 60;

  const pickup: number[] = new Array(order.length);
  pickup[lastIdx] = arrival - drive(env.distanceKm(order[lastIdx], b.hospitalId));
  for (let i = lastIdx - 1; i >= 0; i--) {
    pickup[i] = pickup[i + 1] - DWELL_MIN - drive(env.distanceKm(order[i], order[i + 1]));
  }

  // 병원 → 첫 정류장(공차) → … → 병원
  let loopKm = env.distanceKm(b.hospitalId, order[0]);
  for (let i = 1; i < order.length; i++) loopKm += env.distanceKm(order[i - 1], order[i]);
  loopKm += env.distanceKm(order[lastIdx], b.hospitalId);
  const vehicleDistanceKm = loopKm * 2; // 진료 후 귀가 운행 포함

  // 탑승 시각은 안내하기 쉽게 5분 단위로 내림
  const round5 = (m: number) => Math.floor(m / 5) * 5;

  const plan: DispatchPlan = {
    vehicleId,
    hospitalId: b.hospitalId,
    departureTime: fromMinutes(round5(pickup[0] - drive(env.distanceKm(b.hospitalId, order[0])))),
    stops: order.map((regionId, i) => ({
      regionId,
      pickupTime: fromMinutes(round5(pickup[i])),
      passengers: perRegion.get(regionId)!,
    })),
    totalPassengers: b.passengers,
    vehicleDistanceKm: Math.round(vehicleDistanceKm * 10) / 10,
    maxWaitMinutes: latest - arrival,
  };

  // 탑승자 중 원래 승용차로 갔을 사람들(차량 전환율)이 각자 병원을 왕복했을 때와 비교
  const carKg = order.reduce(
    (sum, r) =>
      sum + perRegion.get(r)! * env.conversionRate * 2 * env.distanceKm(r, b.hospitalId) * env.carKgPerKm,
    0,
  );
  const drtKg = vehicleDistanceKm * env.vanKgPerKm;
  return {
    plan,
    slotIds: b.slots.map((s) => s.id),
    emission: {
      carEmissionKg: carKg,
      drtEmissionKg: drtKg,
      breakEvenPassengers: breakEvenFrom(drtKg, carKg / b.passengers),
    },
  };
}

export function simulateDispatch(slots: ReservationSlot[], criteria: DispatchCriteria, env: DispatchEnv) {
  const bundles = bundleSlots(slots, criteria).sort(
    (a, b) => toMinutes(a.slots[0].timeSlot) - toMinutes(b.slots[0].timeSlot),
  );
  const dispatched: VehiclePlan[] = [];
  const heldBack: VehiclePlan[] = [];
  for (const b of bundles) {
    if (b.passengers >= criteria.minPassengers) {
      dispatched.push(toVehiclePlan(b, `${dispatched.length + 1}호차`, env));
    } else {
      heldBack.push(toVehiclePlan(b, `보류 묶음 ${heldBack.length + 1}`, env));
    }
  }
  return { dispatched, heldBack };
}
