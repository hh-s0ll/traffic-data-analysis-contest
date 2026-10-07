// 여러 화면에서 쓰는 작은 부품들

import { useEffect, useId, useRef, type ReactNode } from 'react';
import s from './common.module.css';

/**
 * 화면이 다루는 내용의 성격. 공모전 준수사항(허위 데이터 금지)에 따라
 * 실증 분석 자리인지, 가상 수요 시뮬레이션인지를 화면마다 밝힌다.
 */
export type ContentKind = 'empirical' | 'simulation' | 'proposal' | 'method';

const KIND_LABEL: Record<ContentKind, string> = {
  empirical: '실증 분석',
  simulation: '정책 시뮬레이션',
  proposal: '정책 제안',
  method: '보고서 필수 항목',
};

/** 화면 제목. 화면이 바뀌면 제목으로 포커스를 옮겨 스크린리더가 새 화면을 읽게 한다. */
export function PageIntro({
  title,
  lead,
  step,
  kind,
  analysis,
}: {
  title: string;
  lead: ReactNode;
  step?: string;
  kind?: ContentKind;
  analysis?: string; // 예: '분석 1, 분석 2'
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // 첫 진입(주소 # 없음)이 아니라 화면 전환일 때만 포커스 이동
    if (window.location.hash) ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className={s.intro}>
      <p className={s.stepRow}>
        {step && <span className={s.step}>{step}</span>}
        {kind && (
          <span className={`${s.kind} ${s[kind]}`}>
            {analysis && <span className={s.analysis}>{analysis}</span>}{' '}
            {KIND_LABEL[kind]}
          </span>
        )}
      </p>
      <h1 ref={ref} tabIndex={-1} className={s.h1}>
        {title}
      </h1>
      <p className={s.lead}>{lead}</p>
    </div>
  );
}

/** 가상 데이터 안내. 화면마다 눈에 띄게 둔다. */
export function MockNotice({ children }: { children?: ReactNode }) {
  return (
    <p className={s.mock} role="note">
      <strong>가상 데이터</strong>
      <span>{children ?? '이 화면의 수치는 설명을 위해 만든 가상 값입니다. 실제 통계가 아닙니다.'}</span>
    </p>
  );
}

/**
 * 슬라이더 + 빼기/더하기 버튼. 고령자도 끌지 않고 버튼으로 값을 바꿀 수 있게 한다.
 */
export function Stepper(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  hint?: string;
  format?: (v: number) => string;
}) {
  const { label, value, min, max, step, unit, onChange, hint, format } = props;
  const id = useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const shown = format ? format(value) : String(value);
  return (
    <div className={s.stepper}>
      <div className={s.stepperHead}>
        <label htmlFor={id} className={s.stepperLabel}>
          {label}
        </label>
        <output htmlFor={id} className={s.stepperValue} aria-live="polite">
          {shown}
          <span className={s.unit}>{unit}</span>
        </output>
      </div>
      {hint && <p className={s.hint} id={`${id}-hint`}>{hint}</p>}
      <div className={s.stepperRow}>
        <button
          type="button"
          className={s.stepBtn}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label={`${label} 줄이기`}
        >
          −
        </button>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-describedby={hint ? `${id}-hint` : undefined}
          aria-valuetext={`${shown}${unit}`}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <button
          type="button"
          className={s.stepBtn}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label={`${label} 늘리기`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** 여러 개 중 하나 고르기 (라디오 그룹을 버튼 모양으로) */
export function Choice<T extends string>(props: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  hideLegend?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className={s.choice}>
      <legend className={props.hideLegend ? 'sr-only' : s.choiceLegend}>{props.legend}</legend>
      <div className={s.choiceRow}>
        {props.options.map((o) => (
          <label key={o.value} className={s.choiceItem}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={props.value === o.value}
              onChange={() => props.onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** 범례 한 칸 */
export function Swatch({ color, border }: { color: string; border?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={s.swatch}
      style={{ background: color, borderColor: border ? 'var(--line-strong)' : color }}
    />
  );
}
