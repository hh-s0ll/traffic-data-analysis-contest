// 데모용 가상 데이터. 실제 통계가 아니며 발표 시 반드시 명시할 것.
//
// 배출계수 값은 임시이며 출처 확인 필요.
// 기획안 10장 확인 작업 4번(승용차·소형 승합 배출계수 출처 확정) 이후 교체한다.

import type { EmissionFactor } from '../api/types';

export const emissionFactors: EmissionFactor[] = [
  {
    id: 'car_gasoline',
    label: '승용차 (휘발유 중형)',
    kgPerKm: 0.17,
    note: '임시값. 출처 확인 필요',
  },
  {
    id: 'van_diesel',
    label: '똑버스 (경유 소형 승합)',
    kgPerKm: 0.26,
    note: '임시값. 출처 확인 필요',
  },
  {
    id: 'van_electric',
    label: '똑버스 (전기 소형 승합)',
    kgPerKm: 0.1,
    note: '임시값. 발전 과정 간접배출 포함 가정. 출처 확인 필요',
  },
];
