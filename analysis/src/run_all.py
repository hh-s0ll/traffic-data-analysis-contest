"""분석 전체를 순서대로 실행한다. 원자료는 analysis/data/raw 에 있어야 한다 (analysis/README.md 참고)."""
import runpy
import sys
from pathlib import Path

if sys.version_info < (3, 12):
    raise SystemExit("Python 3.12 이상이 필요합니다. analysis/README.md를 확인하세요.")

from config import F_BOUNDARY, F_BUS, F_DEPT, F_HOSP, F_POP_AGE, F_POP_TOTAL, F_SIGUNGU, RAW

required = [F_BOUNDARY, F_BOUNDARY.with_suffix(".dbf"), F_BOUNDARY.with_suffix(".shx"),
            F_BOUNDARY.with_suffix(".prj"), F_SIGUNGU, F_POP_AGE, F_POP_TOTAL, F_BUS, F_HOSP, F_DEPT]
missing = [str(path.relative_to(RAW)) for path in required if not path.is_file()]
if missing:
    raise SystemExit("원자료가 준비되지 않았습니다. analysis/README.md의 다운로드 안내를 확인하세요.\n- "
                     + "\n- ".join(missing))

HERE = Path(__file__).parent
for step in ("s01_indicators", "s02_vulnerability", "s02b_ml_validation", "s03_breakeven", "s04_yeoncheon_sim", "s05_scenarios", "s06_surrogate"):
    print(f"\n===== {step} =====")
    runpy.run_path(str(HERE / f"{step}.py"), run_name="__main__")
