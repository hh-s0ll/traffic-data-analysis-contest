// 화면 2. 데이터와 방법
// 분석보고서 필수 항목(활용 데이터, 분석과정 및 방법, AI 기술 활용)을 화면으로 정리한다.
// analysis/의 실제 사용 데이터·방법을 설명한다. 지도·예약 화면의 값은 별도의 가상 시연 데이터다.

import { PageIntro } from '../components/common';
import s from './DataMethods.module.css';

type Status = 'ok' | 'limited' | 'none';

const STATUS_LABEL: Record<Status, string> = {
  ok: '분석에 사용',
  limited: '후속 과제',
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

/** 실제 분석 데이터와 아직 분석에 사용하지 않은 자료를 구분한다. */
const DATA: DataRow[] = [
  {
    name: '행정구역 경계·성연령별 인구',
    provider: '국가데이터처 SGIS',
    platform: '경계 2025년 2분기 · 통계 2024년',
    url: 'https://www.data.go.kr/data/15129688/fileData.do',
    status: 'ok',
    use: '경기도 읍면동 공간 결합, 고령비율과 시뮬레이션 인구 기반',
  },
  {
    name: '병원 위치·종별·진료과목',
    provider: '건강보험심사평가원',
    platform: '보건의료빅데이터개방시스템 · 2026년 6월',
    url: 'https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925',
    status: 'ok',
    use: '병원·종합병원 거리와 병원 거점 설정',
  },
  {
    name: '지역별 의료이용 (관내·관외 진료)',
    provider: '국민건강보험공단',
    platform: '국가통계포털(KOSIS)',
    url: 'https://kosis.kr',
    status: 'limited',
    use: '현재 분석에 미사용. 관외 진료를 반영한 독립 검증은 후속 과제',
  },
  {
    name: '고령운전자 교통사고',
    provider: '한국도로교통공단',
    platform: '교통사고분석시스템(TAAS)',
    url: 'https://taas.koroad.or.kr',
    status: 'limited',
    use: '최신 사고자료를 이용한 사고 감소 효과의 독립 검증은 후속 과제',
  },
  {
    name: '전국 버스정류장 위치정보',
    provider: '국토교통부',
    platform: '공공데이터포털 · 2025년 10월 31일',
    url: 'https://www.data.go.kr/data/15067528/fileData.do',
    status: 'ok',
    use: '정류장 밀도 지표. 운행 횟수·노선 공급은 반영하지 못함',
  },
  {
    name: '운전면허 자진반납',
    provider: '시도 경찰청',
    platform: '시도 단위 공개 자료',
    status: 'limited',
    use: '현재 분석에 미사용. 면허반납 정책 연계의 효과 검증은 후속 과제',
  },
  {
    name: '똑버스 운행 기록, 병원 예약',
    provider: '공개되지 않음',
    platform: '해당 없음',
    status: 'none',
    use: '실제 고령 인구와 가정한 예약자 비율·참여율로 가상 수요 생성',
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
          아래는 실제 분석에 사용한 자료와 후속 과제를 구분한 목록입니다. 세부 전처리와 원자료 파일 구성은 저장소의
          analysis/README.md에서 확인하세요. 지도·예약 데모의 가상 값은 실증 분석 근거가 아닙니다.
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
              기본 40%·적극 60%는 민감도 비교를 위한 가정입니다. 세 값 모두 대상 지역 고령자의 실측 전환율은 아닙니다.
            </dd>
          </div>
          <div>
            <dt>배출계수</dt>
            <dd>KTDB 40km/h 참고값을 사용합니다. 경유 승합은 소형 화물차 대리 계수이며, 전기는 전력배출계수·PV5 전비·충전손실 가정을 반영합니다. 상세 근거는 analysis/src/config.py에 있습니다.</dd>
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
              연천군 가상 수요에서 공동배차·탄소·차량 대수를 계산하고 15개 시군 6,000개 조건으로 확장했습니다. 거리는
              직선거리 × 1.3으로 근사하며, 실제 도로 경로 API나 실제 예약 데이터를 사용한 분석은 아닙니다.
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
                <th scope="row">분석 1 병원 접근성</th>
                <td>GIS 공간 결합과 거리 근사</td>
                <td>병원·종합병원 직선거리 × 1.3, 고령비율, 정류장 밀도 생성. 실제 대중교통 이동시간은 분석하지 않음</td>
                <td>
                  <a href="#/map">화면 3</a>
                </td>
              </tr>
              <tr>
                <th scope="row">분석 2 취약지역 탐지와 유형화</th>
                <td>취약도 지수와 머신러닝 군집</td>
                <td>4개 지표로 상대적 취약지역 120곳 도출. K-평균 유형화, 다른 군집 방법·부트스트랩·랜덤포레스트·PCA 검증</td>
                <td>
                  <a href="#/map">화면 3</a>
                </td>
              </tr>
              <tr>
                <th scope="row">분석 3 공동배차 시뮬레이션</th>
                <td>가상 수요 생성과 경로 최적화</td>
                <td>
                  실제 고령 인구와 가정한 예약자 비율·참여율로 가상 수요를 만들고, 같은 병원·비슷한 시간대 수요를 묶어 승용차 대비
                  이동거리와 탄소를 비교
                </td>
                <td>
                  <a href="#/dispatch">화면 4</a>, <a href="#/carbon">화면 5</a>
                </td>
              </tr>
              <tr>
                <th scope="row">분석 4 운영 성과 대리모델</th>
                <td>XGBoost·랜덤포레스트·SHAP</td>
                <td>시군 단위 GroupKFold 검증, SHAP 설명, 후보 운영 조건을 직접 시뮬레이션으로 재확인. 현실 수요 예측 정확도가 아님</td>
                <td>분석보고서</td>
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
          검증할 부분을 밝힙니다. 자동 재실행·산출물 대조 기록은 analysis/validation에 있으며 최종 해석·제출 책임은 팀원에게 있습니다.
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
                <td>K-평균·가우시안 혼합·계층 군집, 랜덤포레스트·PCA 검증</td>
                <td>읍면동을 취약 유형으로 나눔</td>
                <td>군집별 지표를 보고 유형 이름과 해석을 사람이 정함</td>
              </tr>
              <tr>
                <th scope="row">운영 성과 대리모델</th>
                <td>XGBoost·랜덤포레스트·SHAP</td>
                <td>시뮬레이션 성과 예측·요인 설명과 운영 후보 탐색</td>
                <td>직접 시뮬레이션과 수치 대조, 가정·정책 해석의 최종 확인</td>
              </tr>
              <tr>
                <th scope="row">작성·검토 보조</th>
                <td>Anthropic Claude Code · OpenAI ChatGPT/Codex</td>
                <td>코드·가상 데모·보고서 초안, 재실행 검증, 문서와 저장소 정리</td>
                <td>최종 수치·가정·정책 해석은 제출 전 팀원 확인 필요. 활용 범위는 docs/AI활용내역.md에 기록</td>
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
