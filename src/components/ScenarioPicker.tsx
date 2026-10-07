// 차량 전환율 시나리오 고르기. 화면 3과 화면 4에서 같은 부품을 쓰고, 선택은 ScenarioContext 로 공유된다.

import { useScenario } from '../ScenarioContext';
import { SCENARIOS, type Scenario } from '../lib/emission';
import { pct1 as pct } from '../lib/format';
import { Choice } from './common';
import s from './ScenarioPicker.module.css';

export function ScenarioPicker({ compact }: { compact?: boolean }) {
  const { scenario, setScenarioId } = useScenario();
  return (
    <div className={compact ? s.compact : s.box}>
      <div className={s.head}>
        <Choice<Scenario['id']>
          legend="차량 전환율 시나리오"
          value={scenario.id}
          onChange={setScenarioId}
          options={SCENARIOS.map((x) => ({ value: x.id, label: `${x.label} ${pct(x.conversionRate)}` }))}
        />
      </div>
      <p className={s.basis}>
        <strong>차량 전환율 {pct(scenario.conversionRate)}</strong>
        {scenario.provisional && <span className={s.provisional}>임시값</span>}
        <span>{scenario.basis}</span>
      </p>
      {!compact && (
        <p className={s.explain}>
          차량 전환율은 똑버스 탑승자 가운데 원래 승용차로 병원에 갔을 사람의 비율입니다. 탑승자 전원이 승용차를 탔다고
          가정하면 감축 효과가 부풀려지므로, 이 비율만큼만 승용차 배출이 줄어든다고 계산합니다.
        </p>
      )}
    </div>
  );
}
