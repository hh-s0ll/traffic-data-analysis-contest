// 화면 5. 탄소 손익분기 (분석 3, 정책 시뮬레이션)
// 합승 인원이 몇 명 이상이어야 공동배차가 승용차 이동을 대체해 탄소를 줄이는지 보여준다.
// 차량 전환율 시나리오(보수·기본·적극)로 민감도를 함께 본다 (기획안 5장).

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EmissionFactor } from '../api/types';
import { getEmissionFactors } from '../api/client';
import { useAsync } from '../lib/useAsync';
import {
  DEFAULT_DETOUR,
  DEFAULT_ONE_WAY_KM,
  DEFAULT_VILLAGE_KM,
  SCENARIOS,
  carEmissionKg,
  compare,
  crossingPoint,
  type BreakEvenInput,
} from '../lib/emission';
import { kg, pct1 as pct } from '../lib/format';
import { useScenario } from '../ScenarioContext';
import { Choice, MockNotice, PageIntro, Stepper } from '../components/common';
import { ScenarioPicker } from '../components/ScenarioPicker';
import s from './CarbonBreakEven.module.css';

type VanId = 'van_diesel' | 'van_electric';

/** 민감도 표에 쓰는 거리와 차량 정원 */
const SENSITIVITY_KM = [5, 10, 15, 20, 30];
const VAN_CAPACITY = 15;

export function CarbonBreakEven() {
  const { data: factors } = useAsync(getEmissionFactors, []);
  if (!factors) return <p>배출계수를 불러오는 중입니다.</p>;
  return <Calculator factors={factors} />;
}

function Calculator({ factors }: { factors: EmissionFactor[] }) {
  const factorOf = (id: EmissionFactor['id']) => factors.find((f) => f.id === id)!;
  const { scenario } = useScenario();

  const [oneWayKm, setOneWayKm] = useState(DEFAULT_ONE_WAY_KM);
  const [passengers, setPassengers] = useState(8);
  const [detour, setDetour] = useState(DEFAULT_DETOUR);
  const [villageKm, setVillageKm] = useState(DEFAULT_VILLAGE_KM);
  const [van, setVan] = useState<VanId>('van_diesel');

  const car = factorOf('car_gasoline');
  const vanF = factorOf(van);
  const inputFor = (conversionRate: number, km = oneWayKm): BreakEvenInput => ({
    oneWayKm: km,
    villageKm,
    detourFactor: detour,
    conversionRate,
    carKgPerKm: car.kgPerKm,
    vanKgPerKm: vanF.kgPerKm,
  });
  const input = inputFor(scenario.conversionRate);
  const result = compare(passengers, input);
  const nStar = result.breakEvenPassengers;
  const cross = crossingPoint(input);
  const diff = result.carEmissionKg - result.drtEmissionKg;
  const reachable = nStar <= VAN_CAPACITY;

  const maxN = Math.min(30, Math.max(15, nStar + 3, passengers));
  const series = useMemo(
    () =>
      Array.from({ length: maxN }, (_, i) => {
        const n = i + 1;
        return { n, car: +carEmissionKg(n, input).toFixed(2), drt: +result.drtEmissionKg.toFixed(2) };
      }),
    [maxN, oneWayKm, villageKm, detour, van, scenario.conversionRate, car.kgPerKm],
  );

  return (
    <>
      <PageIntro
        step="화면 5"
        kind="simulation"
        analysis="분석 3"
        title="탄소 손익분기"
        lead="똑버스는 마을을 돌며 사람을 태우므로 적게 타면 오히려 승용차보다 탄소를 더 냅니다. 몇 명 이상 함께 타야 승용차 이동을 대체해 탄소가 줄어드는지 계산합니다."
      />
      <MockNotice>
        배출계수, 기본·적극 시나리오의 전환율, 거리 가정은 임시값입니다. 실제 계수와 전환율은 출처 확인 후 바꿔
        넣습니다.
      </MockNotice>

      <ScenarioPicker />

      <div className={s.layout}>
        <section aria-labelledby="input-title" className={s.inputs}>
          <h2 id="input-title" className={s.h2}>
            운영 조건
          </h2>
          <Stepper
            label="병원까지 거리 (편도)"
            value={oneWayKm}
            min={3}
            max={40}
            step={1}
            unit="km"
            onChange={setOneWayKm}
          />
          <Stepper
            label="합승 인원"
            value={passengers}
            min={1}
            max={VAN_CAPACITY}
            step={1}
            unit="명"
            onChange={setPassengers}
          />
          <Stepper
            label="우회계수"
            value={detour}
            min={1}
            max={1.8}
            step={0.05}
            unit="배"
            format={(v) => v.toFixed(2)}
            hint="마을을 돌며 태우느라 곧장 가는 길보다 몇 배 더 달리는지"
            onChange={(v) => setDetour(Math.round(v * 100) / 100)}
          />
          <Stepper
            label="마을 경유 거리"
            value={villageKm}
            min={0}
            max={30}
            step={1}
            unit="km"
            hint="첫 마을부터 마지막 마을까지 태우러 다니는 거리"
            onChange={setVillageKm}
          />
          <Choice<VanId>
            legend="똑버스 차량"
            value={van}
            onChange={setVan}
            options={[
              { value: 'van_diesel', label: '경유 승합' },
              { value: 'van_electric', label: '전기 승합' },
            ]}
          />
        </section>

        <section aria-labelledby="result-title" className={s.result}>
          <h2 id="result-title" className="sr-only">
            계산 결과
          </h2>
          <div className={s.headline}>
            <div className={s.nStar}>
              <p className={s.label}>최소 합승 인원 ({scenario.label} 시나리오)</p>
              <p className={s.nStarNum} aria-live="polite">
                {nStar}
                <span>명</span>
              </p>
              <p className={s.nStarSub}>
                {reachable
                  ? `${nStar}명 이상 함께 타면 공동배차가 승용차 이동보다 탄소를 덜 냅니다`
                  : `정원 ${VAN_CAPACITY}명을 넘어, 이 조건에서는 공동배차로 탄소를 줄일 수 없습니다`}
              </p>
            </div>
            <div className={s.now}>
              <p className={s.label}>합승 {passengers}명일 때</p>
              <dl className={s.nowList}>
                <div>
                  <dt>
                    <span className={s.keyCar} aria-hidden="true" />
                    대체되는 승용차 이동
                  </dt>
                  <dd>{kg(result.carEmissionKg)}</dd>
                </div>
                <div>
                  <dt>
                    <span className={s.keyDrt} aria-hidden="true" />
                    공동배차 똑버스
                  </dt>
                  <dd>{kg(result.drtEmissionKg)}</dd>
                </div>
              </dl>
              <p className={diff > 0 ? s.verdictGood : s.verdictBad} aria-live="polite">
                {diff > 0
                  ? `공동배차가 ${kg(diff)} 적습니다`
                  : diff === 0
                    ? '두 방법의 배출이 같습니다'
                    : `아직 승용차보다 ${kg(-diff)} 많습니다`}
              </p>
            </div>
          </div>

          <figure className={s.figure}>
            <figcaption className={s.figcaption}>
              합승 인원에 따른 탄소 배출 (왕복 한 번, kg, 차량 전환율 {pct(scenario.conversionRate)})
            </figcaption>
            <div aria-hidden="true">
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={series} margin={{ top: 36, right: 24, bottom: 28, left: 8 }}>
                  <CartesianGrid stroke="#dfe8e1" vertical={false} />
                  {nStar < maxN && (
                    <ReferenceArea
                      x1={nStar}
                      x2={maxN}
                      fill="#dcebe0"
                      fillOpacity={0.7}
                      ifOverflow="hidden"
                      label={{
                        value: '공동배차가 더 적은 구간',
                        position: 'insideTop',
                        offset: 14,
                        fontSize: 16,
                        fill: '#1f5d3c',
                        fontWeight: 700,
                      }}
                    />
                  )}
                  <XAxis
                    dataKey="n"
                    type="number"
                    domain={[1, maxN]}
                    ticks={series.map((d) => d.n)}
                    tick={{ fontSize: 16, fill: '#14231b' }}
                    label={{ value: '합승 인원 (명)', position: 'insideBottom', offset: -16, fontSize: 16, fill: '#45554c' }}
                  />
                  <YAxis tick={{ fontSize: 16, fill: '#14231b' }} width={56} />
                  <Tooltip
                    formatter={(v, name) => [`${Number(v).toFixed(1)}kg`, name]}
                    labelFormatter={(n) => `합승 ${n}명`}
                    contentStyle={{ fontSize: 16 }}
                  />
                  <Legend verticalAlign="top" align="left" height={32} wrapperStyle={{ fontSize: 17, top: 0 }} />
                  <Line
                    name="대체되는 승용차 이동"
                    dataKey="car"
                    stroke="#b4531f"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                  <Line
                    name="공동배차 똑버스"
                    dataKey="drt"
                    stroke="#1f5d3c"
                    strokeWidth={3}
                    strokeDasharray="8 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  {nStar <= maxN && (
                    <ReferenceLine
                      x={nStar}
                      stroke="#14231b"
                      strokeWidth={2}
                      label={{
                        value: `최소 합승 인원 ${nStar}명`,
                        position: 'top',
                        fontSize: 17,
                        fontWeight: 800,
                        fill: '#14231b',
                      }}
                    />
                  )}
                  <ReferenceDot x={passengers} y={result.carEmissionKg} r={8} fill="#fff" stroke="#b4531f" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="sr-only">
              승용차 대체 배출은 인원에 비례해 늘고, 공동배차 배출은 인원과 관계없이 {kg(result.drtEmissionKg)}로
              일정합니다. 두 선은 약 {cross.toFixed(1)}명에서 만나며, {nStar}명부터 공동배차가 더 적습니다.
            </p>
          </figure>

          <div className={s.formula}>
            <h3 className={s.h3}>어떻게 계산했나요</h3>
            <p>
              <span className={s.fLabel}>대체되는 승용차 이동</span>
              {passengers}명 × 차량 전환율 {pct(scenario.conversionRate)} × 병원 왕복 {oneWayKm * 2}km × 승용차
              배출계수 {car.kgPerKm}kg = <strong>{kg(result.carEmissionKg)}</strong>
            </p>
            <p>
              <span className={s.fLabel}>공동배차 똑버스</span>
              (마을 경유 {villageKm}km + 병원 왕복 {oneWayKm * 2}km) × 우회계수 {detour.toFixed(2)} × 승합차
              배출계수 {vanF.kgPerKm}kg = <strong>{kg(result.drtEmissionKg)}</strong>
            </p>
            <p>
              탑승자 한 명이 대체하는 승용차 배출은 {kg(carEmissionKg(1, input))}입니다. 공동배차 배출{' '}
              {kg(result.drtEmissionKg)}를 이 값으로 나누면 {cross.toFixed(2)}명이므로, <strong>{nStar}명 이상</strong>{' '}
              함께 타야 공동배차가 더 적게 배출합니다.
            </p>
            <p className={s.factorNote}>
              배출계수는 차량이 1km 달릴 때 나오는 이산화탄소 양(kg)입니다. {car.label} {car.kgPerKm}kg, {vanF.label}{' '}
              {vanF.kgPerKm}kg 모두 임시값이며 출처 확인이 필요합니다.
            </p>
          </div>
        </section>
      </div>

      <section aria-labelledby="sens-title" className={s.sensitivity}>
        <h2 id="sens-title" className={s.h2}>
          거리와 시나리오에 따른 최소 합승 인원
        </h2>
        <p className={s.sub}>
          지금 설정한 우회계수 {detour.toFixed(2)}, 마을 경유 거리 {villageKm}km,{' '}
          {van === 'van_diesel' ? '경유' : '전기'} 승합 기준입니다. 정원 {VAN_CAPACITY}명을 넘는 칸은 이 조건에서
          선제 배차로 탄소를 줄일 수 없는 경우입니다.
        </p>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <caption className="sr-only">병원까지 편도 거리별, 차량 전환율 시나리오별 최소 합승 인원</caption>
            <thead>
              <tr>
                <th scope="col">병원까지 편도 거리</th>
                {SCENARIOS.map((sc) => (
                  <th scope="col" key={sc.id} className={sc.id === scenario.id ? s.colOn : undefined}>
                    {sc.label} ({pct(sc.conversionRate)})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SENSITIVITY_KM.map((km) => (
                <tr key={km}>
                  <th scope="row">{km}km</th>
                  {SCENARIOS.map((sc) => {
                    const n = compare(1, inputFor(sc.conversionRate, km)).breakEvenPassengers;
                    const over = n > VAN_CAPACITY;
                    return (
                      <td
                        key={sc.id}
                        className={`${over ? s.cellOver : ''} ${sc.id === scenario.id ? s.colOn : ''}`}
                      >
                        {over ? `${n}명 (정원 초과)` : `${n}명`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.sub}>
          읽는 법: 병원이 멀수록 한 사람이 대체하는 승용차 배출이 커져 최소 합승 인원이 줄어듭니다. 이 표가 &ldquo;병원까지
          몇 km 이상 떨어진 마을에서는 몇 명 이상일 때 선제 배차한다&rdquo;는 운영 기준의 초안이 됩니다.
        </p>
      </section>
    </>
  );
}
