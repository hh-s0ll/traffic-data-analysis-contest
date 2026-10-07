// 화면 4. 공동배차 시뮬레이터 (분석 3, 정책 시뮬레이션)
// 하루치 익명 예약을 "묶기 기준"에 따라 차량별로 묶는다. 기준을 바꾸면 결과가 곧바로 다시 계산된다.

import { useMemo, useState } from 'react';
import type { DispatchCriteria, ReservationSlot, VehiclePlan } from '../api/types';
import { getDefaultReservationDate, getReservations, simulateDispatch } from '../api/client';
import { useAsync } from '../lib/useAsync';
import { useData } from '../DataContext';
import { ARRIVAL_BUFFER_MIN } from '../lib/dispatch';
import { kg, pct1 as pct, toMinutes } from '../lib/format';
import { MockNotice, PageIntro, Stepper } from '../components/common';
import { ScenarioPicker } from '../components/ScenarioPicker';
import { useScenario } from '../ScenarioContext';
import s from './DispatchSimulator.module.css';

const DEFAULT_CRITERIA: DispatchCriteria = { maxWaitMinutes: 60, vehicleCapacity: 12, minPassengers: 4 };

export function DispatchSimulator() {
  const { data: date } = useAsync(getDefaultReservationDate, []);
  if (!date) return <p>예약 날짜를 불러오는 중입니다.</p>;
  return <Simulator date={date} />;
}

function Simulator({ date }: { date: string }) {
  const { regionById, hospitalById } = useData();
  const [criteria, setCriteria] = useState<DispatchCriteria>(DEFAULT_CRITERIA);
  const set = (k: keyof DispatchCriteria) => (v: number) => setCriteria((c) => ({ ...c, [k]: v }));

  const { data: slots } = useAsync(() => getReservations({ date }), [date]);
  const { scenario } = useScenario();
  const { data: result } = useAsync(
    () => simulateDispatch(date, criteria, { conversionRate: scenario.conversionRate, vanFactorId: 'van_diesel' }),
    [date, criteria.maxWaitMinutes, criteria.vehicleCapacity, criteria.minPassengers, scenario.conversionRate],
  );

  // 예약 슬롯 id → 배정 결과 이름
  const assignment = useMemo(() => {
    const m = new Map<string, { label: string; held: boolean }>();
    result?.dispatched.forEach((v) => v.slotIds.forEach((id) => m.set(id, { label: v.plan.vehicleId, held: false })));
    result?.heldBack.forEach((v) => v.slotIds.forEach((id) => m.set(id, { label: '호출형 유지', held: true })));
    return m;
  }, [result]);

  const sortedSlots = useMemo(
    () =>
      [...(slots ?? [])].sort(
        (a, b) => toMinutes(a.timeSlot) - toMinutes(b.timeSlot) || a.hospitalId.localeCompare(b.hospitalId),
      ),
    [slots],
  );

  const regionName = (id: string) => regionById.get(id)?.name ?? id;
  const hospitalName = (id: string) => hospitalById.get(id)?.name ?? id;

  const totalPeople = sortedSlots.reduce((n, x) => n + x.passengers, 0);
  const rode = result?.dispatched.reduce((n, v) => n + v.plan.totalPassengers, 0) ?? 0;
  const heldPeople = result?.heldBack.reduce((n, v) => n + v.plan.totalPassengers, 0) ?? 0;
  const carSum = result?.dispatched.reduce((n, v) => n + v.emission.carEmissionKg, 0) ?? 0;
  const drtSum = result?.dispatched.reduce((n, v) => n + v.emission.drtEmissionKg, 0) ?? 0;
  const savingVehicles =
    result?.dispatched.filter((v) => v.emission.drtEmissionKg < v.emission.carEmissionKg).length ?? 0;

  return (
    <>
      <PageIntro
        step="화면 4"
        kind="simulation"
        analysis="분석 3"
        title="공동배차 시뮬레이터"
        lead="병원 예약을 시간대별로 묶어 똑버스가 먼저 데리러 가는 계획을 만듭니다. 가운데 기준을 바꾸면 오른쪽 배차 계획이 곧바로 바뀝니다."
      />
      <MockNotice>
        연천군 마을들의 {formatDate(date)} 하루치 가상 예약입니다. 실제 분석에서는 관외 진료량과 고령 인구로 만든 가상
        수요 시나리오가 이 자리에 들어갑니다. 병원 이름 중 &lsquo;가상&rsquo;이 붙은 곳은 실제
        기관이 아닙니다.
      </MockNotice>

      <div className={s.layout}>
        {/* 왼쪽: 예약 슬롯 */}
        <section aria-labelledby="slots-title" className={s.slots}>
          <h2 id="slots-title" className={s.h2}>
            하루치 예약 {sortedSlots.length}건, {totalPeople}명
          </h2>
          <div className={s.privacy}>
            <p>
              <strong>받는 정보</strong> 마을, 병원, 시간대, 인원
            </p>
            <p>
              <strong>받지 않는 정보</strong> 이름, 병명, 진료과, 연락처
            </p>
          </div>
          <div className={s.tableWrap} tabIndex={0} aria-label="예약 목록, 스크롤 가능">
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">시간대</th>
                  <th scope="col">마을</th>
                  <th scope="col">병원</th>
                  <th scope="col" className={s.numCol}>
                    인원
                  </th>
                  <th scope="col">배정</th>
                </tr>
              </thead>
              <tbody>
                {sortedSlots.map((r) => {
                  const a = assignment.get(r.id);
                  return (
                    <tr key={r.id}>
                      <td className={s.time}>{r.timeSlot}</td>
                      <td>{regionName(r.regionId)}</td>
                      <td className={s.hospCell}>{hospitalName(r.hospitalId)}</td>
                      <td className={s.numCol}>{r.passengers}명</td>
                      <td>
                        {a && <span className={a.held ? s.tagHeld : s.tagCar}>{a.label}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 가운데: 묶기 기준 */}
        <section aria-labelledby="criteria-title" className={s.criteria}>
          <h2 id="criteria-title" className={s.h2}>
            묶기 기준
          </h2>
          <Stepper
            label="허용 대기시간"
            value={criteria.maxWaitMinutes}
            min={10}
            max={120}
            step={10}
            unit="분"
            hint={`병원에 도착(첫 진료 ${ARRIVAL_BUFFER_MIN}분 전)해서 가장 늦은 진료까지 기다릴 수 있는 시간`}
            onChange={set('maxWaitMinutes')}
          />
          <Stepper
            label="차량 정원"
            value={criteria.vehicleCapacity}
            min={4}
            max={15}
            step={1}
            unit="명"
            onChange={set('vehicleCapacity')}
          />
          <Stepper
            label="최소 출발 인원"
            value={criteria.minPassengers}
            min={1}
            max={8}
            step={1}
            unit="명"
            hint="이보다 적게 모이면 먼저 데리러 가지 않고 기존처럼 불러서 타게 합니다"
            onChange={set('minPassengers')}
          />
          <div className={s.scenario}>
            <ScenarioPicker compact />
          </div>
          <button type="button" className={s.reset} onClick={() => setCriteria(DEFAULT_CRITERIA)}>
            처음 기준으로 되돌리기
          </button>
          <div className={s.rule}>
            <h3 className={s.h3}>묶는 방법</h3>
            <ol>
              <li>같은 병원 예약을 시간 순으로 늘어놓습니다.</li>
              <li>허용 대기시간 안에 드는 예약을 한 차에 태웁니다.</li>
              <li>정원이 차면 다음 차를 새로 만듭니다.</li>
              <li>최소 출발 인원보다 적은 묶음은 먼저 가지 않고 기존 호출형으로 둡니다.</li>
            </ol>
          </div>
        </section>

        {/* 오른쪽: 배차 계획 */}
        <section aria-labelledby="plans-title" className={s.plans}>
          <h2 id="plans-title" className={s.h2}>
            배차 계획
          </h2>
          {result && (
            <>
              <dl className={s.summary} aria-live="polite">
                <div>
                  <dt>먼저 가는 차량</dt>
                  <dd>{result.dispatched.length}대</dd>
                </div>
                <div>
                  <dt>함께 타는 사람</dt>
                  <dd>
                    {rode}명<span className={s.of}> / {totalPeople}명</span>
                  </dd>
                </div>
                <div>
                  <dt>호출형 유지</dt>
                  <dd>{heldPeople}명</dd>
                </div>
              </dl>
              {result.dispatched.length > 0 && (
                <p className={s.carbonSum}>
                  차량 전환율 {pct(scenario.conversionRate)}({scenario.label} 시나리오)로 보면, 이 차량들이 대체하는 승용차
                  이동은 <strong className={s.car}>{kg(carSum)}</strong>, 공동배차는 <strong className={s.drt}>{kg(drtSum)}</strong>를
                  배출합니다. 탄소가 줄어드는 차량은 <strong>{result.dispatched.length}대 중 {savingVehicles}대</strong>입니다.
                  병원이 가까운 경로는 대체되는 승용차 이동이 짧아 탄소를 줄이기 어렵습니다.
                </p>
              )}

              <ol className={s.vehicleList}>
                {result.dispatched.map((v) => (
                  <VehicleItem key={v.plan.vehicleId} v={v} capacity={criteria.vehicleCapacity} regionName={regionName} hospitalName={hospitalName} />
                ))}
              </ol>
              {result.dispatched.length === 0 && (
                <p className={s.empty}>기준을 만족하는 묶음이 없습니다. 최소 출발 인원을 낮추거나 대기시간을 늘려 보세요.</p>
              )}

              {result.heldBack.length > 0 && (
                <div className={s.held}>
                  <h3 className={s.h3}>선제 배차 안 함 (기존 호출형 유지)</h3>
                  <p className={s.heldDesc}>
                    최소 출발 인원 {criteria.minPassengers}명에 못 미쳐 먼저 데리러 가지 않는 묶음입니다. 빈 차가 도는 것을
                    막기 위해서입니다.
                  </p>
                  <ul className={s.heldList}>
                    {result.heldBack.map((v) => (
                      <li key={v.plan.vehicleId}>
                        <span className={s.heldTime}>
                          {slotTimes(v, sortedSlots)} 진료
                        </span>
                        <span>{hospitalName(v.plan.hospitalId)}</span>
                        <span>{v.plan.stops.map((st) => regionName(st.regionId)).join(', ')}</span>
                        <span className={s.heldPax}>{v.plan.totalPassengers}명</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

function VehicleItem({
  v,
  capacity,
  regionName,
  hospitalName,
}: {
  v: VehiclePlan;
  capacity: number;
  regionName: (id: string) => string;
  hospitalName: (id: string) => string;
}) {
  const { plan, emission } = v;
  const saves = emission.drtEmissionKg < emission.carEmissionKg;
  return (
    <li className={s.vehicle}>
      <div className={s.vHead}>
        <h3 className={s.vName}>{plan.vehicleId}</h3>
        <p className={s.vDest}>{hospitalName(plan.hospitalId)} 행</p>
      </div>
      <ol className={s.stops} aria-label="정차 순서">
        {plan.stops.map((st, i) => (
          <li key={st.regionId}>
            <span className={s.stopNo} aria-hidden="true">
              {i + 1}
            </span>
            <span className={s.stopTime}>{st.pickupTime}</span>
            <span className={s.stopName}>{regionName(st.regionId)}</span>
            <span className={s.stopPax}>{st.passengers}명 탑승</span>
          </li>
        ))}
      </ol>
      <dl className={s.vStats}>
        <div>
          <dt>총 인원</dt>
          <dd>{plan.totalPassengers}명</dd>
        </div>
        <div>
          <dt>운행거리</dt>
          <dd>{plan.vehicleDistanceKm}km</dd>
        </div>
        <div>
          <dt>최대 대기</dt>
          <dd>{plan.maxWaitMinutes}분</dd>
        </div>
      </dl>
      <p className={s.vCarbon}>
        탄소 <span className={s.car}>대체되는 승용차 {kg(emission.carEmissionKg)}</span>
        <span className={s.drt}>공동배차 {kg(emission.drtEmissionKg)}</span>
        {saves ? (
          <strong className={s.good}>{kg(emission.carEmissionKg - emission.drtEmissionKg)} 줄어듦</strong>
        ) : (
          <strong className={s.bad}>
            {emission.breakEvenPassengers > capacity
              ? `정원 ${capacity}명을 다 채워도 탄소가 줄지 않는 경로, ${kg(emission.drtEmissionKg - emission.carEmissionKg)} 늘어남`
              : `최소 합승 인원 ${emission.breakEvenPassengers}명에 못 미쳐 ${kg(emission.drtEmissionKg - emission.carEmissionKg)} 늘어남`}
          </strong>
        )}
      </p>
      <p className={s.vNote}>운행거리는 차고지에서 출발하는 빈 차 구간과 진료 후 귀가 운행을 포함합니다.</p>
    </li>
  );
}

/** 묶음에 든 예약들의 진료 시간대 (예: "09:00" 또는 "13:00~13:30") */
function slotTimes(v: VehiclePlan, slots: ReservationSlot[]) {
  const times = slots.filter((x) => v.slotIds.includes(x.id)).map((x) => x.timeSlot).sort();
  const first = times[0];
  const last = times[times.length - 1];
  return first === last ? first : `${first}~${last}`;
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
