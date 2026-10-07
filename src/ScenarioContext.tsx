// 차량 전환율 시나리오를 화면 1·3·4가 함께 쓴다. 한 화면에서 바꾸면 다른 화면에도 반영된다.

import { createContext, useContext, useState, type ReactNode } from 'react';
import { SCENARIOS, type Scenario } from './lib/emission';

interface ScenarioValue {
  scenario: Scenario;
  setScenarioId: (id: Scenario['id']) => void;
}

const ScenarioContext = createContext<ScenarioValue | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [id, setScenarioId] = useState<Scenario['id']>('conservative');
  const scenario = SCENARIOS.find((s) => s.id === id)!;
  return <ScenarioContext.Provider value={{ scenario, setScenarioId }}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  const v = useContext(ScenarioContext);
  if (!v) throw new Error('ScenarioProvider 안에서만 사용할 수 있습니다');
  return v;
}
