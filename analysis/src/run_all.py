"""분석 전체를 순서대로 실행한다. 원자료는 analysis/data/raw 에 있어야 한다 (analysis/README.md 참고)."""
import runpy
from pathlib import Path

HERE = Path(__file__).parent
for step in ("s01_indicators", "s02_vulnerability", "s02b_ml_validation", "s03_breakeven", "s04_yeoncheon_sim", "s05_scenarios", "s06_surrogate"):
    print(f"\n===== {step} =====")
    runpy.run_path(str(HERE / f"{step}.py"), run_name="__main__")
