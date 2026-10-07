// 화면 전환은 주소의 # 뒷부분으로 한다 (라우터 라이브러리 없이).
// 새로고침해도 같은 화면이 유지되고, 발표 중 특정 화면 주소를 바로 열 수 있다.

import { useEffect, useState } from 'react';
import styles from './App.module.css';
import { Overview } from './screens/Overview';
import { VulnerabilityMap } from './screens/VulnerabilityMap';
import { DispatchSimulator } from './screens/DispatchSimulator';
import { CarbonBreakEven } from './screens/CarbonBreakEven';
import { Policy } from './screens/Policy';
import { DataMethods } from './screens/DataMethods';

const ROUTES = [
  // 순서는 분석보고서 흐름(배경 → 데이터·방법 → 결과 → 정책)을 따른다
  { path: 'overview', label: '개요', Screen: Overview },
  { path: 'data', label: '데이터와 방법', Screen: DataMethods },
  { path: 'map', label: '취약지역 지도', Screen: VulnerabilityMap },
  { path: 'dispatch', label: '공동배차 시뮬레이터', Screen: DispatchSimulator },
  { path: 'carbon', label: '탄소 손익분기', Screen: CarbonBreakEven },
  { path: 'policy', label: '정책 제안', Screen: Policy },
] as const;

type RoutePath = (typeof ROUTES)[number]['path'];

function currentPath(): RoutePath {
  const p = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES.find((r) => r.path === p)?.path ?? 'overview') as RoutePath;
}

export function App() {
  const [path, setPath] = useState<RoutePath>(currentPath);

  useEffect(() => {
    const onHash = () => {
      // '#/' 로 시작하지 않는 해시(본문 건너뛰기 링크 '#main' 등)는 화면 전환이 아니다
      if (!window.location.hash.startsWith('#/')) return;
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const route = ROUTES.find((r) => r.path === path)!;
  const { Screen } = route;

  useEffect(() => {
    document.title = `${route.label} — 부르지 않아도 오는 똑버스`;
  }, [route.label]);

  return (
    <>
      <a className={styles.skip} href="#main">
        본문으로 건너뛰기
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <p className={styles.kicker}>병원 예약 연계 공동배차 데모</p>
            <p className={styles.title}>부르지 않아도 오는 똑버스</p>
          </div>
          <p className={styles.mockBadge}>가상 데이터 시뮬레이션</p>
        </div>
        <nav aria-label="화면 이동" className={styles.nav}>
          <ol className={styles.navList}>
            {ROUTES.map((r, i) => (
              <li key={r.path}>
                <a
                  href={`#/${r.path}`}
                  className={styles.navLink}
                  aria-current={r.path === path ? 'page' : undefined}
                >
                  <span className={styles.navNum}>{i + 1}</span>
                  {r.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>
      <main id="main" className={styles.main}>
        <Screen key={path} />
      </main>
      <footer className={styles.footer}>
        <p>
          이 화면의 모든 수치는 설명을 위해 만든 가상 데이터입니다. 실제 통계나 실제 예약 정보가 아닙니다.
        </p>
        <p>숲과나눔 × 한겨레 AI와 함께하는 교통문제 해결을 위한 데이터 분석 공모전 출품용</p>
      </footer>
    </>
  );
}
