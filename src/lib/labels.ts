// 화면에 보여줄 이름과 단계 구분. 영문 코드값을 화면에 그대로 노출하지 않기 위함.

import type { ClusterType, Hospital } from '../api/types';

export const CLUSTER_LABEL: Record<ClusterType, string> = {
  transit_poor: '대중교통 공급 부족형',
  far_hospital: '병원 원거리형',
  aging_isolated: '고령 고립형',
  stable: '상대적 양호',
};

export const CLUSTER_DESC: Record<ClusterType, string> = {
  transit_poor: '버스 노선과 운행 횟수가 적어 대중교통으로 병원에 가기 어려운 곳',
  far_hospital: '자가용으로도 병원까지 멀어 이동 부담이 큰 곳',
  aging_isolated: '고령 인구 비율이 매우 높고 이동 수단이 부족한 곳',
  stable: '다른 지역보다 병원 이동 여건이 나은 곳',
};

export const HOSPITAL_TYPE_LABEL: Record<Hospital['type'], string> = {
  public: '공공의료원',
  general: '종합병원',
  clinic: '의원',
};

/** 취약도 단계. 지도 색 진하기와 범례에 함께 쓴다. */
export interface VulnLevel {
  key: 'low' | 'mid' | 'high' | 'severe';
  label: string;
  min: number; // 이 점수 이상
}

export const VULN_LEVELS: VulnLevel[] = [
  { key: 'low', label: '낮음', min: 0 },
  { key: 'mid', label: '보통', min: 45 },
  { key: 'high', label: '높음', min: 60 },
  { key: 'severe', label: '매우 높음', min: 75 },
];

/** 이 점수 이상이면 "의료이동 취약지역"으로 센다 */
export const VULNERABLE_THRESHOLD = 60;

export function vulnLevel(score: number): VulnLevel {
  let found = VULN_LEVELS[0];
  for (const l of VULN_LEVELS) if (score >= l.min) found = l;
  return found;
}
