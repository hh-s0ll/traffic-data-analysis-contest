// analysis/src/config.py와 동일한 보고서 참고 계수. 실측 운행 배출량이 아니다.
// 예약·지역·거리는 가상 데이터이며 이 계수를 적용한 데모 결과도 실제 운영 성과가 아니다.

import type { EmissionFactor } from '../api/types';

export const emissionFactors: EmissionFactor[] = [
  {
    id: 'car_gasoline',
    label: '승용차 (휘발유 중형)',
    kgPerKm: 0.171,
    note: 'KTDB 차종·속도별 배출식, 휘발유 승용차 40km/h 참고값',
  },
  {
    id: 'van_diesel',
    label: '똑버스 (경유 소형 승합)',
    kgPerKm: 0.227,
    note: 'KTDB 소형 경유 화물차 40km/h 값을 승합차 대리 계수로 사용 (실측값 아님)',
  },
  {
    id: 'van_electric',
    label: '똑버스 (전기 소형 승합)',
    kgPerKm: 0.104,
    note: '2023 전력배출계수 0.4173kg/kWh ÷ PV5 전비 4.4km/kWh × 충전손실 가정 1.1',
  },
];
