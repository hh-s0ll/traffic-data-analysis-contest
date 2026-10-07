// 화면 2. 데이터와 방법
// 분석보고서 필수 항목(활용 데이터, 분석과정 및 방법, AI 기술 활용)을 화면으로 정리한다.
// 내용은 기획안 v4 의 3·4·7장을 따른다. 데이터를 실제로 수집하면 상태와 URL을 갱신한다.

import { PageIntro } from '../components/common';
import s from './DataMethods.module.css';

type Status = 'ok' | 'limited' | 'none';

const STATUS_LABEL: Record<Status, string> = {
  ok: '확보 가능',
  limited: '제한적',
  none: '확보 불가',
};

interface DataRow {
  name: string;
  provider: string;
  platform: string;
  url?: string;
  status: Status;
  use: string;
}

/** 기획안 7장 데이터 표. URL은 플랫폼 첫 화면이며, 보고서에는 데이터셋별 상세 URL을 적는다. */
const DATA: DataRow[] = [
  {
    name: '고령운전자 교통사고',
    provider: '한국도로교통공단',
    platform: '교통사고분석시스템(TAAS), 공공데이터포털',
    url: 'https://taas.koroad.or.kr',
    status: 'ok',
    use: '문제 정의, 안전 효과 추정. 시군구와 가해운전자 연령대 교차는 웹 조회',
  },
  {
    name: '병원 위치와 종별',
    provider: '건강보험심사평가원',
    platform: '공공데이터포털 (병원정보서비스)',
    url: 'https://www.data.go.kr',
    status: 'ok',
    use: '분석 1 병원 거점 설정',
  },
  {
    name: '지역별 의료이용 (관내·관외 진료)',
    provider: '국민건강보험공단',
    platform: '국가통계포털(KOSIS)',
    url: 'https://kosis.kr',
    status: 'ok',
    use: '분석 2 관외 진료 비율, 분석 3 가상 수요 생성',
  },
  {
    name: '고령 인구와 접근성 지표',
    provider: '국토교통부 국토지리정보원',
    platform: '국토정보플랫폼 통계지도',
    url: 'https://map.ngii.go.kr',
    status: 'ok',
    use: '분석 1 접근시간, 분석 2 고령 인구',
  },
  {
    name: '버스 정류장과 노선',
    provider: '경기도',
    platform: '경기데이터드림 (버스정보)',
    url: 'https://data.gg.go.kr',
    status: 'ok',
    use: '분석 2 대중교통 공급 점수',
  },
  {
    name: '운전면허 자진반납',
    provider: '시도 경찰청',
    platform: '시도 단위 공개 자료',
    status: 'limited',
    use: '시도 단위만 있어 정책 연계 근거로만 사용',
  },
  {
    name: '똑버스 운행 기록, 병원 예약',
    provider: '공개되지 않음',
    platform: '해당 없음',
    status: 'none',
    use: '관외 진료량과 고령 인구로 만든 가상 수요 시나리오로 대체',
  },
];

export function DataMethods() {
  return (
    <>
      <PageIntro
        step="화면 2"
        kind="method"
        title="데이터와 방법"
        lead="어떤 공개데이터로, 어떤 순서와 방법으로 분석하는지 정리했습니다. 분석보고서의 필수 항목인 활용 데이터, 분석과정 및 방법, AI 기술 활용과 같은 구성입니다."
      />

      <section aria-labelledby="data-title" className={s.section}>
        <h2 id="data-title" className={s.h2}>
          활용 데이터
        </h2>
        <p className={s.sub}>
          보고서 표에는 데이터셋별 상세 주소, 수집 기준시점, 주요 변수, 이용조건을 함께 적습니다. 아래 주소는 제공
          플랫폼의 첫 화면입니다.
        </p>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">데이터</th>
                <th scope="col">제공기관</th>
                <th scope="col">플랫폼</th>
                <th scope="col">상태</th>
                <th scope="col">쓰는 곳</th>
              </tr>
            </thead>
            <tbody>
              {DATA.map((d) => (
                <tr key={d.name}>
                  <th scope="row">{d.name}</th>
                  <td>{d.provider}</td>
                  <td>
                    {d.platform}
                    {d.url && (
                      <>
                        <br />
                        <a href={d.url} target="_blank" rel="noreferrer noopener" className={s.url}>
                          {d.url.replace(/^https:\/\//, '')}
                          <span className="sr-only"> (새 창에서 열림)</span>
                        </a>
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`${s.status} ${s[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                  </td>
                  <td>{d.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className={s.h3}>계산에 쓰는 가정값</h3>
        <dl className={s.assume}>
          <div>
            <dt>차량 전환율 21.3%</dt>
            <dd>
              수원시정연구원 똑버스 이용자 조사에서 도입 전 자가용 주이용 응답 비율. 도시 조사라 보수 시나리오 기준값으로 쓰고,
              기본·적극 시나리오는 팀 확정 전까지 임시값입니다.
            </dd>
          </div>
          <div>
            <dt>배출계수</dt>
            <dd>승용차와 소형 승합(똑버스 차종) 배출계수는 출처 확정 전 임시값입니다.</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="method-title" className={s.section}>
        <h2 id="method-title" className={s.h2}>
          분석과정 및 방법
        </h2>
        <ol className={s.stages}>
          <li>
            <p className={s.stageTag}>1단계 실증 분석</p>
            <h3>경기도 전체 스크리닝</h3>
            <p>
              읍·면·동 단위로 가벼운 지표를 써서 의료이동 취약지역을 찾고 유형을 나눈 뒤 사례지역을 고릅니다. 도 전체를 먼저
              보기 때문에 &ldquo;왜 이 지역인가&rdquo;에 데이터로 답할 수 있습니다.
            </p>
          </li>
          <li>
            <p className={s.stageTag}>2단계 정책 시뮬레이션</p>
            <h3>사례지역 상세 분석</h3>
            <p>
              고른 시군(연천 등)에서 경로 기반 접근시간, 가상 수요, 공동배차, 탄소를 계산합니다. 호출량이 많은 경로 분석은
              사례지역에만 적용합니다.
            </p>
          </li>
        </ol>

        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">분석</th>
                <th scope="col">방법</th>
                <th scope="col">내용</th>
                <th scope="col">데모 화면</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">분석 1 병원 접근시간 격차</th>
                <td>GIS와 경로 분석</td>
                <td>1단계: 병원까지 직선·도로 거리와 정류장 밀도로 근사. 2단계: 사례지역 마을별 자가용 대 대중교통 소요시간</td>
                <td>
                  <a href="#/map">화면 3</a>
                </td>
              </tr>
              <tr>
                <th scope="row">분석 2 취약지역 탐지와 유형화</th>
                <td>취약도 지수와 머신러닝 군집</td>
                <td>고령 인구, 대중교통 공급, 병원 접근성, 관외 진료를 결합해 읍면동을 유형화하고 사례지역 선정</td>
                <td>
                  <a href="#/map">화면 3</a>
                </td>
              </tr>
              <tr>
                <th scope="row">분석 3 공동배차 시뮬레이션</th>
                <td>가상 수요 생성과 경로 최적화</td>
                <td>
                  관외 진료량과 고령 인구로 병원 이동 수요를 만들고, 같은 병원·비슷한 시간대 수요를 묶어 배차한 뒤 승용차 대비
                  이동거리와 탄소를 비교
                </td>
                <td>
                  <a href="#/dispatch">화면 4</a>, <a href="#/carbon">화면 5</a>
                </td>
              </tr>
              <tr>
                <th scope="row">보조 분석 시민 체감</th>
                <td>LLM 텍스트 분류와 사람 검증</td>
                <td>교통·의료이동 민원과 지역 기사를 &ldquo;병원 이동 불편, 배차 지연, 운전 불안&rdquo;으로 분류하고 표본을 사람이 검수</td>
                <td>없음</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={s.split}>
          <div>
            <h3 className={s.h3}>실증 분석이라고 말하는 것</h3>
            <p>의료이동 취약지역 탐지 (분석 1, 2). 실제 공개데이터로 &ldquo;취약지역을 실증적으로 탐지했다&rdquo;고 씁니다.</p>
          </div>
          <div>
            <h3 className={s.h3}>시뮬레이션이라고 말하는 것</h3>
            <p>
              예약 연계 공동배차와 탄소 (분석 3). &ldquo;가상 수요 시나리오에서 이런 조건일 때 효과가 나타났다&rdquo;고 씁니다.
            </p>
          </div>
        </div>
        <p className={s.limit}>
          <strong>공개데이터로 알 수 없는 것</strong> 정확한 출발 마을, 실제 방문 병원, 예약 시간대, 이용 교통수단, 보호자
          동행 여부. 따라서 &ldquo;마을별 실제 예약 수요를 파악했다&rdquo;고 쓰지 않습니다.
        </p>
      </section>

      <section aria-labelledby="ai-title" className={s.section}>
        <h2 id="ai-title" className={s.h2}>
          AI 기술 활용
        </h2>
        <p className={s.sub}>
          모든 분석을 AI라고 부르지 않습니다. AI는 실제로 쓰는 곳에만 쓰고, 사용한 서비스와 범위, 주요 프롬프트, 사람이
          검증한 부분을 밝힙니다. 도구 이름이 정해지지 않은 칸은 확정 후 채웁니다.
        </p>
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">쓰는 곳</th>
                <th scope="col">AI 도구</th>
                <th scope="col">활용 범위</th>
                <th scope="col">사람이 검증하는 부분</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">분석 2 유형화</th>
                <td>머신러닝 군집 (알고리즘 확정 후 기재)</td>
                <td>읍면동을 취약 유형으로 나눔</td>
                <td>군집별 지표를 보고 유형 이름과 해석을 사람이 정함</td>
              </tr>
              <tr>
                <th scope="row">보조 분석</th>
                <td>대형 언어모델 (서비스 확정 후 기재)</td>
                <td>민원·기사 문장을 세 가지 불편 유형으로 분류</td>
                <td>표본을 사람이 다시 분류해 일치율 확인</td>
              </tr>
              <tr>
                <th scope="row">이 데모 화면</th>
                <td>Claude Code (Anthropic)</td>
                <td>화면 코드, 가상 데이터, 배차·탄소 계산 코드 작성</td>
                <td>계산식과 화면 내용을 팀원이 기획안과 대조해 검토. 작업 지시문은 저장소 docs 폴더에 기록</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h3 className={s.h3}>데이터와 AI 이용 원칙</h3>
        <ul className={s.checks}>
          <li>개인정보, 비공개 자료를 외부 AI 서비스에 넣지 않습니다.</li>
          <li>데이터 모델에 이름, 병명, 진료과, 연락처 항목이 없습니다. 마을, 시간대, 인원만 다룹니다.</li>
          <li>AI가 만든 분류와 코드는 사람이 확인한 뒤 결과에 씁니다.</li>
          <li>가상 값은 화면과 보고서에 가상 값이라고 표시합니다.</li>
        </ul>
      </section>
    </>
  );
}
