/**
 * 공용 타입 — API 담당자와 공유하는 계약서.
 *
 * 규칙
 * - 기획 문서(4장)에 정의된 필드명은 바꾸지 않는다. 바꿔야 하면 주석으로 이유를 남긴다.
 * - 개인 식별 정보(이름, 병명, 진료과, 연락처 등) 필드를 절대 추가하지 않는다.
 *   마을 ID, 시간대, 인원만 다룬다.
 * - 4장에 없는 타입은 아래 "추가 타입" 구역에 두고, 왜 필요한지 주석을 단다.
 */

/** 읍·면·동 단위 지역 */
export interface Region {
  id: string; // 행정동 코드
  sigungu: string; // 예: "연천군"
  name: string; // 예: "신서면"
  elderlyRatio: number; // 고령인구 비율 (0~1)
  population: number;
  transitSupply: number; // 대중교통 공급 점수 (0~100)
  hospitalMinutesCar: number; // 거점 병원까지 자가용 소요분
  hospitalMinutesTransit: number; // 거점 병원까지 대중교통 소요분
  outboundCareRatio: number; // 관외 진료 비율 (0~1)
  vulnerabilityScore: number; // 의료이동 취약도 (0~100)
  clusterType: ClusterType;
  drtCovered: boolean; // 현재 수요응답형 버스 운행 여부
}

export type ClusterType =
  | 'transit_poor' // 대중교통 공급 부족형
  | 'far_hospital' // 병원 원거리형
  | 'aging_isolated' // 고령 고립형
  | 'stable'; // 상대적 양호

export interface Hospital {
  id: string;
  name: string;
  type: 'public' | 'general' | 'clinic';
  sigungu: string;
}

/** 익명 예약 단위. 개인 식별 정보는 담지 않는다. */
export interface ReservationSlot {
  id: string;
  regionId: string;
  hospitalId: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // "09:00" 등 30분 단위
  passengers: number; // 해당 마을·시간대의 인원 수
}

/** 공동배차 결과 */
export interface DispatchPlan {
  vehicleId: string;
  hospitalId: string;
  departureTime: string;
  stops: { regionId: string; pickupTime: string; passengers: number }[];
  totalPassengers: number;
  vehicleDistanceKm: number; // 공차·우회 포함 총 운행거리
  maxWaitMinutes: number;
}

/** 탄소 비교 결과 */
export interface EmissionComparison {
  carEmissionKg: number; // 개별 승용차 합계
  drtEmissionKg: number; // 공동배차
  breakEvenPassengers: number; // 최소 합승 인원 N*
}

/* ------------------------------------------------------------------ */
/* 추가 타입 (4장에 없음)                                               */
/* ------------------------------------------------------------------ */

/**
 * 공동배차 묶기 기준.
 * 추가 이유: 화면 3에서 사용자가 조절하는 값을 API 요청 파라미터로 그대로 넘기기 위함.
 */
export interface DispatchCriteria {
  maxWaitMinutes: number; // 허용 대기시간(분). 병원 도착 후 진료까지 가장 오래 기다리는 사람 기준
  vehicleCapacity: number; // 차량 정원(명)
  minPassengers: number; // 최소 출발 인원(명). 미만이면 선제 배차하지 않음
}

/**
 * 탄소 비교에 쓰는 가정.
 * 추가 이유: 차량별 탄소 비교가 차량 전환율 시나리오(기획안 5장)와 차량 연료에 따라 달라진다.
 */
export interface EmissionAssumptions {
  conversionRate: number; // 차량 전환율 (0~1). 탑승자 중 원래 승용차로 갔을 비율
  vanFactorId: 'van_diesel' | 'van_electric';
}

/**
 * 차량 한 대의 배차 계획과 그 탄소 비교.
 * 추가 이유: DispatchPlan 필드를 바꾸지 않고 차량별 탄소 비교를 함께 돌려주기 위함.
 */
export interface VehiclePlan {
  plan: DispatchPlan;
  emission: EmissionComparison;
  slotIds: string[]; // 이 차량(묶음)에 들어간 예약 슬롯 id. 화면 3 표에서 배정 결과를 보여주기 위함
}

/**
 * 공동배차 시뮬레이션 전체 결과.
 * 추가 이유: "선제 배차 안 함(기존 호출형 유지)" 묶음을 배차 계획과 구분해 돌려줘야 한다.
 * heldBack 의 DispatchPlan 은 실제로 운행하지 않는 '가상 묶음'이며 비교용으로만 쓴다.
 */
export interface DispatchResult {
  date: string;
  criteria: DispatchCriteria;
  dispatched: VehiclePlan[];
  heldBack: VehiclePlan[];
}

/**
 * 배출계수 (kg CO2 / 차량 km).
 * 추가 이유: 화면 4 계산과 화면 3 차량별 비교가 같은 계수를 쓰도록 API에서 받아온다.
 */
export interface EmissionFactor {
  id: 'car_gasoline' | 'van_diesel' | 'van_electric';
  label: string;
  kgPerKm: number;
  note: string; // 출처·가정 메모
}
