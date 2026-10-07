// 숫자·시간 표시 도우미

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const pct = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** 소수 첫째 자리까지 보여주는 비율 (예: 21.3%, 40%) */
export const pct1 = (ratio: number) => `${+(ratio * 100).toFixed(1)}%`;

export const kg = (v: number) => `${v.toFixed(1)}kg`;

export const num = (v: number) => v.toLocaleString('ko-KR');
