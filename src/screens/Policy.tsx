// 화면 6. 정책 제안 (정적 문서)
// 분석보고서의 "정책제안 및 기대효과" 항목 구성(적용 대상, 기대효과, 적용 사례)을 따른다. 내용은 기획안 v4 5·8장.

import { PageIntro } from '../components/common';
import type { MouseEvent, ReactNode } from 'react';
import s from './Policy.module.css';

/** 문서 안 이동 링크. 주소의 # 은 화면 전환에 쓰므로, 주소를 바꾸지 않고 해당 절로 스크롤·포커스한다. */
function TocLink({ to, children }: { to: string; children: ReactNode }) {
  const go = (e: MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(to);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    el.focus({ preventScroll: true });
  };
  return (
    <a href="#/policy" onClick={go}>
      {children}
    </a>
  );
}

interface Proposal {
  id: string;
  title: string;
  body: ReactNode;
  target: string;
  basis: ReactNode;
}

const PROPOSALS: Proposal[] = [
  {
    id: 'p1',
    title: '데이터 기반 선택적 운영',
    body: (
      <>
        분석 2에서 찾은 취약지역 가운데 <strong>최소 합승 인원 이상의 예약이 모이는 마을과 시간대</strong>에만 똑버스를
        먼저 보내고, 그 밖에는 지금처럼 불러서 타는 방식을 유지합니다. 예약이 적은 날 빈 차가 도는 것을 막아 탄소와
        운영비를 함께 줄입니다.
      </>
    ),
    target: '의료이동 취약지역 중 병원 예약 수요가 모이는 읍면',
    basis: (
      <>
        <a href="#/map">취약지역 지도</a>, <a href="#/carbon">탄소 손익분기</a>
      </>
    ),
  },
  {
    id: 'p2',
    title: '공공의료원 연계 시범',
    body: (
      <>
        사례지역의 우선 읍면에서 공공의료원과 <strong>익명 예약 연계</strong>를 시범 운영합니다. 공공의료원은 고령 환자의
        정기 진료가 많고, 예약 부도가 줄어드는 이점이 있어 참여 동기가 분명합니다.
      </>
    ),
    target: '연천 등 사례지역 우선 읍면과 공공의료원',
    basis: <a href="#/dispatch">공동배차 시뮬레이터</a>,
  },
  {
    id: 'p3',
    title: '면허반납 연계',
    body: (
      <>
        고령자가 운전을 쉽게 그만두지 못하는 까닭은 병원처럼 꼭 가야 하는 곳에 갈 다른 방법이 없어서입니다. 경기도 고령운전자
        면허 자진반납 지원과 연계해, 반납하면 <strong>병원 연계 똑버스 이용권</strong>을 지원합니다.
      </>
    ),
    target: '면허를 자진반납하는 사례지역 고령운전자',
    basis: '면허 자진반납 통계는 시도 단위만 공개되어 정책 연계 근거로만 씁니다',
  },
  {
    id: 'p4',
    title: '교통비 지원 연계',
    body: (
      <>
        병원 연계 똑버스 이용을 <strong>K-패스와 모두의 카드 환급 대상</strong>에 포함합니다. 고령자의 병원 이동 비용
        부담을 줄이고, 자가용 대신 공동배차를 고를 이유를 하나 더 만듭니다.
      </>
    ),
    target: '병원 연계 똑버스 이용자',
    basis: '기존 교통비 환급 제도의 대상 확대',
  },
];

export function Policy() {
  return (
    <article className={s.doc}>
      <PageIntro
        step="화면 6"
        kind="proposal"
        title="정책 제안과 기대효과"
        lead="대중교통만으로 해결되지 않아 고령자가 자가용에 기댈 수밖에 없는 의료이동을 데이터로 찾아내고, 병원 예약 수요가 충분히 모이는 지역과 시간대에만 똑버스를 먼저 보냅니다."
      />

      <nav aria-label="이 문서의 차례" className={s.toc}>
        <p className={s.tocTitle}>차례</p>
        <ol>
          {PROPOSALS.map((p) => (
            <li key={p.id}>
              <TocLink to={p.id}>{p.title}</TocLink>
            </li>
          ))}
          <li>
            <TocLink to="effects">기대효과</TocLink>
          </li>
          <li>
            <TocLink to="faq">예상 질문과 답</TocLink>
          </li>
        </ol>
      </nav>

      {PROPOSALS.map((p, i) => (
        <section key={p.id} id={p.id} tabIndex={-1} className={s.section} aria-labelledby={`${p.id}-title`}>
          <p className={s.num}>제안 {i + 1}</p>
          <h2 id={`${p.id}-title`} className={s.h2}>
            {p.title}
          </h2>
          <p>{p.body}</p>
          <dl className={s.meta}>
            <div>
              <dt>적용 대상</dt>
              <dd>{p.target}</dd>
            </div>
            <div>
              <dt>근거</dt>
              <dd>{p.basis}</dd>
            </div>
          </dl>
        </section>
      ))}

      <section id="effects" tabIndex={-1} className={s.section} aria-labelledby="effects-title">
        <h2 id="effects-title" className={s.h2}>
          기대효과
        </h2>
        <p>보건, 안전, 환경 문제를 하나의 교통정책으로 잇습니다. 각 효과는 아래 방법으로 측정합니다.</p>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">효과</th>
              <th scope="col">측정 방법</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">보건 (의료 접근)</th>
              <td>병원까지 대중교통 소요시간 단축폭, 자가용 대비 격차 축소율</td>
            </tr>
            <tr>
              <th scope="row">안전 (사고)</th>
              <td>고령운전자 병원 통행 감소분 × 고령운전자 사고율 (시나리오 추정)</td>
            </tr>
            <tr>
              <th scope="row">환경 (탄소)</th>
              <td>최소 합승 인원 이상으로 운영할 때 승용차 대비 감축량 (차량 전환율 시나리오별)</td>
            </tr>
          </tbody>
        </table>
        <p className={s.after}>
          <strong>적용 사례</strong> 분석 결과는 &ldquo;병원까지 몇 km 이상 떨어진 마을에서는 몇 명 이상 모일 때 선제
          배차한다&rdquo;는 운영 기준으로 쓰입니다. <a href="#/carbon">탄소 손익분기</a> 화면의 거리별 표가 이 기준의
          초안입니다.
        </p>
        <p className={s.after}>
          <strong>확장안</strong> 병원행 차량의 빈 좌석을 예약 없는 고령자에게 열어 시내로 나가는 이동도 함께 돕습니다.
        </p>
      </section>

      <section id="faq" tabIndex={-1} className={s.section} aria-labelledby="faq-title">
        <h2 id="faq-title" className={s.h2}>
          예상 질문과 답
        </h2>
        <dl className={s.faq}>
          <div>
            <dt>의료정보를 다루는 것 아닌가요?</dt>
            <dd>
              진료과와 병명 없이 마을, 시간, 인원만 전달하는 동의 기반 익명 연계입니다. 이 데모의 데이터 구조에도 개인을
              알아볼 수 있는 항목이 없습니다.
            </dd>
          </div>
          <div>
            <dt>수요가 적은 날에는 어떻게 하나요?</dt>
            <dd>최소 합승 인원보다 적으면 먼저 가지 않고 기존 호출형으로 운영해 빈 차 운행을 막습니다.</dd>
          </div>
          <div>
            <dt>병원은 왜 참여하나요?</dt>
            <dd>예약 부도가 줄고 고령 환자의 정기 진료가 유지됩니다. 공공의료원부터 적용합니다.</dd>
          </div>
          <div>
            <dt>앱을 못 쓰는 고령자는요?</dt>
            <dd>예약만 하면 배차는 자동으로 이루어지고, 안내는 문자와 전화로 합니다.</dd>
          </div>
        </dl>
        <p className={s.after}>
          분석의 한계(공개데이터로 알 수 없는 것)는 <a href="#/data">데이터와 방법</a> 화면에 정리했습니다.
        </p>
      </section>
    </article>
  );
}
