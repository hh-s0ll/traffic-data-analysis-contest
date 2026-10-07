// 데모용 가상 데이터. 실제 통계가 아니며 발표 시 반드시 명시할 것.
//
// - 공공의료원 두 곳은 실제 기관명을 쓰되, 이 데모의 예약·배차 수치와는 무관하다.
// - 종합병원과 의원은 "가상" 이름이다. 진료과를 짐작할 수 있는 이름은 쓰지 않는다.

import type { Hospital } from '../api/types';

export const hospitals: Hospital[] = [
  { id: 'H-P01', name: '연천군보건의료원', type: 'public', sigungu: '연천군' },
  { id: 'H-P02', name: '경기도의료원 의정부병원', type: 'public', sigungu: '의정부시' },
  { id: 'H-G01', name: '동두천 가상종합병원', type: 'general', sigungu: '동두천시' },
  { id: 'H-G02', name: '포천 가상종합병원', type: 'general', sigungu: '포천시' },
  { id: 'H-G03', name: '양평 가상종합병원', type: 'general', sigungu: '양평군' },
  { id: 'H-C01', name: '전곡 가상의원', type: 'clinic', sigungu: '연천군' },
  { id: 'H-C02', name: '연천 가상의원', type: 'clinic', sigungu: '연천군' },
  { id: 'H-C03', name: '가평 가상의원', type: 'clinic', sigungu: '가평군' },
  { id: 'H-C04', name: '양평 가상의원', type: 'clinic', sigungu: '양평군' },
  { id: 'H-C05', name: '여주 가상의원', type: 'clinic', sigungu: '여주시' },
  { id: 'H-C06', name: '일동 가상의원', type: 'clinic', sigungu: '포천시' },
];
