"""보고서 산출물의 구조·핵심 수치를 검사한다 (전체 재실행/현실 타당성 검증의 대체가 아님)."""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def verify():
    table = ROOT / 'output/tables'
    checks = []

    def check(name, actual, expected):
        checks.append({'name': name, 'actual': actual, 'expected': expected, 'pass': actual == expected})

    def load(name):
        return json.loads((table / name).read_text(encoding='utf-8-sig'))

    stage1 = load('summary_stage1.json')
    ml = load('summary_ml_validation.json')
    scenario = load('summary_scenarios.json')
    surrogate = load('summary_surrogate.json')
    check('분석 읍면동', stage1['n_dong'], 600)
    check('취약지역', stage1['n_vulnerable'], 120)
    check('고령 고립형', ml['isolated_assigned'], 68)
    check('시나리오 수', scenario['시나리오수'], 6000)
    check('시군 수', len(scenario['시군']), 15)
    check('시군당 조건', scenario['시군당'], 400)
    check('AI·직접 시뮬레이션 판단 일치율', surrogate['판단 일치율'], 0.8)
    vulnerable = pd.read_csv(table / 't12_vulnerable_120.csv')
    check('취약지역 명단', len(vulnerable), 120)
    check('취약지역 코드 중복', int(vulnerable['ADM_CD'].duplicated().sum()), 0)
    scenarios = pd.read_csv(table / 't17_scenarios.csv')
    check('시나리오 행수', len(scenarios), 6000)
    check('시군별 조건 수', bool(scenarios.groupby('시군').size().eq(400).all()), True)
    final = pd.read_csv(table / 't22_final_recommendation.csv')
    check('최종 추천 시군', len(final), 15)
    check('현행 수송률 0인 시군', int(final['현행 수송률'].eq(0).sum()), 15)
    csv_files = list((ROOT / 'data/processed').glob('*.csv')) + list(table.glob('*.csv'))
    check('CSV 산출물 수', len(csv_files), 26)
    check('요약 JSON 수', len(list(table.glob('summary_*.json'))), 6)
    for path in csv_files:
        frame = pd.read_csv(path)
        check(f'{path.name}: 빈 표 여부', bool(len(frame) > 0), True)
        numbers = frame.select_dtypes(include='number').to_numpy()
        check(f'{path.name}: 무한대 여부', bool(np.isinf(numbers).any()), False)
    figures = sorted((ROOT / 'output/figures').glob('fig*.png'))
    check('그림 수', len(figures), 8)
    for path in figures:
        with Image.open(path) as img:
            img.verify()
        with Image.open(path) as img:
            check(f'{path.name}: 유효 크기', img.width > 100 and img.height > 100, True)
    # GPKG는 대용량이라 GitHub/코드 묶음에 포함하지 않으며 전체 실행 시 재생성된다.
    for name, rows in [('gyeonggi_eupmyeondong_indicators.gpkg', 601),
                       ('gyeonggi_eupmyeondong_vulnerability_scores.gpkg', 600)]:
        path = ROOT / 'data/processed' / name
        if path.exists():
            import geopandas as gpd
            frame = gpd.read_file(path)
            check(f'{name}: 행수', len(frame), rows)
            check(f'{name}: 좌표계', frame.crs.to_epsg(), 5179)
            check(f'{name}: geometry 누락', int(frame.geometry.isna().sum()), 0)
    return {'pass': all(c['pass'] for c in checks), 'checks': checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json', type=Path, help='선택: 검사 결과 JSON 저장 경로')
    args = parser.parse_args()
    try:
        result = verify()
    except (OSError, ValueError, KeyError) as exc:
        result = {'pass': False, 'error': str(exc)}
    text = json.dumps(result, ensure_ascii=False, indent=2)
    print(text)
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(text + '\n', encoding='utf-8')
    return 0 if result['pass'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
