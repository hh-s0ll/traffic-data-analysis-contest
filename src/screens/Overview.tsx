// 화면 1. 개요 (분석보고서의 "분석 배경 및 목적")
// 문제를 한 문장으로 보여주고, 공개 자료 근거 수치와 이 데모의 핵심 숫자를 나눠 보여준다.

import { useEffect, useRef } from 'react';
import { getEmissionFactors } from '../api/client';
import { useData } from '../DataContext';
import { useScenario } from '../ScenarioContext';
import { useAsync } from '../lib/useAsync';
import { DEFAULT_DETOUR, DEFAULT_ONE_WAY_KM, DEFAULT_VILLAGE_KM, compare } from '../lib/emission';
import { VULNERABLE_THRESHOLD } from '../lib/labels';
import { pct1 as pct } from '../lib/format';
import s from './Overview.module.css';

export function Overview() {
  const { regions } = useData();
  const { scenario } = useScenario();
  const { data: factors } = useAsync(getEmissionFactors, []);
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // 다른 화면에서 넘어왔을 때 제목으로 포커스 이동 (PageIntro 와 같은 동작)
    if (window.location.hash) h1.current?.focus({ preventScroll: true });
  }, []);

  const vulnerable = regions.filter((r) => r.vulnerabilityScore >= VULNERABLE_THRESHOLD);
  const avgGap = Math.round(
    vulnerable.reduce((n, r) => n + (r.hospitalMinutesTransit - r.hospitalMinutesCar), 0) / (vulnerable.length || 1),
  );
  const uncovered = vulnerable.filter((r) => !r.drtCovered).length;

  const nStar = factors
    ? compare(1, {
        oneWayKm: DEFAULT_ONE_WAY_KM,
        villageKm: DEFAULT_VILLAGE_KM,
        detourFactor: DEFAULT_DETOUR,
        conversionRate: scenario.conversionRate,
        carKgPerKm: factors.find((f) => f.id === 'car_gasoline')!.kgPerKm,
        vanKgPerKm: factors.find((f) => f.id === 'van_diesel')!.kgPerKm,
      }).breakEvenPassengers
    : null;

  return (
    <>
      <div className={s.hero}>
        <p className={s.step}>화면 1 개요</p>
        <h1 ref={h1} className={s.problem} tabIndex={-1}>
          경기도 농촌의 고령자는 병원에 가려면 운전대를 놓을 수 없습니다.
        </h1>
        <p className={s.lead}>
          병원과 장보기 같은 필수 이동을 대신할 교통수단이 부족하기 때문입니다. 병원 이동은 반복해서 생기고 예약 시간이
          정해져 있어, 수요를 미리 묶어 공동배차로 바꾸기에 가장 알맞은 필수 이동입니다. 이 데모는 병원 예약을 묶어 똑버스가
          부르지 않아도 먼저 데리러 가는 방식이 <strong>어디에서</strong>, <strong>몇 명 이상</strong> 탈 때 효과가
          있는지 보여줍니다.
        </p>
      </div>

      <section aria-labelledby="evidence-title" className={s.evidence}>
        <div className={s.evidenceHead}>
          <h2 id="evidence-title" className={s.h2}>
            근거 수치
          </h2>
          <p className={s.sourceTag}>공개 자료</p>
        </div>
        <ul className={s.evList}>
          <li>
            <p className={s.evNum}>8.1% → 16.5%</p>
            <p>2018년 경기도 고령 면허소지자 비중 대비 고령운전자 사망사고 비중 (2배 이상)</p>
          </li>
          <li>
            <p className={s.evNum}>+37.3%</p>
            <p>2015~2018년 경기도 고령운전자 교통사고 증가율 (같은 기간 전체 사고는 +0.9%)</p>
          </li>
          <li>
            <p className={s.evNum}>31.0%</p>
            <p>연천군 고령화율 (2023년, 도내 1위). 2042년 50% 이상 전망</p>
          </li>
        </ul>
        <p className={s.evNote}>
          사고 수치는 2019년 경기도 발표 자료 기준입니다. 보고서에서는 교통사고분석시스템(TAAS)의 최신 연도로 다시
          산출합니다.
        </p>
      </section>

      <p className={s.mock} role="note">
        <strong>아래부터는 가상 데이터로 만든 시뮬레이션입니다.</strong>
        <span>
          지명과 위 근거 수치 외의 모든 수치, 예약, 배출계수는 설명을 위해 만든 값이며 실제 분석 결과가 아닙니다. 실제 분석을
          마치면 같은 화면에 결과가 들어갑니다.
        </span>
      </p>

      <section aria-labelledby="numbers-title">
        <h2 id="numbers-title" className="sr-only">
          데모 핵심 숫자 (가상 값)
        </h2>
        <ul className={s.numbers}>
          <li>
            <p className={s.numLabel}>
              의료이동 취약지역 <span className={s.virtual}>가상 값</span>
            </p>
            <p className={s.num}>
              {vulnerable.length}
              <span>곳</span>
            </p>
            <p className={s.numDesc}>
              경기도 읍·면·동 {regions.length}곳 중 취약도 {VULNERABLE_THRESHOLD}점 이상. 이 중 {uncovered}곳은
              수요응답형 버스가 다니지 않습니다.
            </p>
            <a className={s.more} href="#/map">
              취약지역 지도 보기
            </a>
          </li>
          <li>
            <p className={s.numLabel}>
              평균 이동시간 격차 <span className={s.virtual}>가상 값</span>
            </p>
            <p className={`${s.num} ${s.clay}`}>
              {avgGap}
              <span>분</span>
            </p>
            <p className={s.numDesc}>취약지역에서 병원까지 대중교통이 자가용보다 더 걸리는 시간의 평균입니다.</p>
            <a className={s.more} href="#/map">
              지역별 시간 비교 보기
            </a>
          </li>
          <li>
            <p className={s.numLabel}>
              최소 합승 인원 <span className={s.virtual}>가상 값</span>
            </p>
            <p className={s.num}>
              {nStar ?? '…'}
              <span>명</span>
            </p>
            <p className={s.numDesc}>
              병원까지 {DEFAULT_ONE_WAY_KM}km, 차량 전환율 {pct(scenario.conversionRate)}({scenario.label} 시나리오)일 때
              이 인원 이상 함께 타야 승용차 이동을 대체해 탄소가 줄어듭니다.
            </p>
            <a className={s.more} href="#/carbon">
              탄소 손익분기 계산해 보기
            </a>
          </li>
        </ul>
      </section>

      <section aria-labelledby="stance-title" className={s.stance}>
        <h2 id="stance-title" className={s.h2}>
          이 연구가 하지 않는 것과 하는 것
        </h2>
        <table className={s.stanceTable}>
          <thead>
            <tr>
              <th scope="col">이렇게 하지 않습니다</th>
              <th scope="col">이렇게 합니다</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>&ldquo;농촌에 똑버스를 더 공급하자&rdquo;</td>
              <td>
                수요가 충분히 모이는 지역과 시간대에만 <strong>선택적으로</strong> 먼저 배차
              </td>
            </tr>
            <tr>
              <td>&ldquo;똑버스를 도입하면 탄소가 줄어든다&rdquo; (결론을 미리 정함)</td>
              <td>
                &ldquo;몇 명 이상 함께 타야 탄소가 줄어드는가&rdquo;를 <strong>분석으로 찾음</strong>
              </td>
            </tr>
            <tr>
              <td>&ldquo;똑버스의 효과를 평가한다&rdquo;</td>
              <td>
                &ldquo;어디에 먼저 적용해야 하는가&rdquo;를 <strong>탐색</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section aria-labelledby="flow-title" className={s.flow}>
        <h2 id="flow-title" className={s.h2}>
          병원 예약 연계 공동배차는 이렇게 움직입니다
        </h2>
        <ol className={s.steps}>
          <li>
            <h3>병원 예약</h3>
            <p>고령자는 평소처럼 전화나 방문으로 진료를 예약합니다.</p>
          </li>
          <li>
            <h3>익명 연계</h3>
            <p>동의한 환자의 마을, 시간, 인원만 전달합니다. 이름이나 병명은 보내지 않습니다.</p>
          </li>
          <li>
            <h3>기준 확인과 배차</h3>
            <p>탑승 인원이 최소 합승 인원 이상이면 공동배차 경로를 만들고, 모자라면 기존 호출형으로 둡니다.</p>
          </li>
          <li>
            <h3>마을 탑승과 귀가</h3>
            <p>문자나 전화로 안내받아 마을에서 타고, 진료 후 같은 차로 돌아옵니다.</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="q-title" className={s.questions}>
        <h2 id="q-title" className={s.h2}>
          핵심 연구 질문
        </h2>
        <ol>
          <li>
            <a href="#/map">고령자가 자가용에 의존할 수밖에 없는 의료이동 취약지역은 어디인가</a>
          </li>
          <li>
            <a href="#/dispatch">병원 예약 연계 공동배차는 운영 가능한가</a>
          </li>
          <li>
            <a href="#/carbon">몇 명 이상 공동배차해야 개별 승용차 이동보다 탄소배출이 줄어드는가</a>
          </li>
        </ol>
        <p className={s.method}>
          데이터 출처와 분석 방법, AI 활용 내역은 <a href="#/data">데이터와 방법</a> 화면에 정리했습니다.
        </p>
      </section>
    </>
  );
}
