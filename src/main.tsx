import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 글꼴은 npm 패키지에서 번들에 포함한다 (외부 CDN 요청 없음)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/global.css';
import { App } from './App';
import { DataProvider } from './DataContext';
import { ScenarioProvider } from './ScenarioContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <ScenarioProvider>
        <App />
      </ScenarioProvider>
    </DataProvider>
  </StrictMode>,
);
