# 분석 코드 (실제 공개데이터)

분석보고서: [../report/팀명_분석보고서.docx](../report/팀명_분석보고서.docx) (미리보기 PDF 같은 폴더)

데모 웹앱(`../src`)은 가상 데이터입니다. 이 폴더는 **실제 공개데이터**로 한 분석입니다.

## 재현 방법

```bash
cd analysis
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Python 3.13.9 에서 확인
.venv/Scripts/python src/s00_download.py                  # 원자료 내려받기 (심평원 자료는 안내에 따라 직접)
.venv/Scripts/python src/run_all.py                       # 모든 표와 그림 재생성 (약 4분 30초)
```

Windows에서 한글 출력이 깨지면 `PYTHONIOENCODING=utf-8`을 붙이세요. 그림 글꼴은 맑은 고딕(Windows)입니다.
난수 시드는 용도별로 고정되어 있어 같은 입력이면 같은 결과가 나옵니다: 군집·부트스트랩·랜덤포레스트·XGBoost 42, 연천 몬테카를로 11·22·33·44·55(`s04`의 `SEEDS`), 배출계수 불확실성 7, 15개 시군 시나리오 2026(`s05`).

## 저장소에 들어 있는 것

| 경로 | 내용 |
| --- | --- |
| `src/` | 분석 코드 (`s00` 내려받기 → `s01`·`s02`·`s02b`·`s03`·`s04`·`s05`·`s06` 분석, `run_all.py`) |
| `requirements.txt` | 실행에 쓴 패키지 정확한 버전 |
| `data/processed/*.csv` | 가공 결과: 읍면동별 지표, 취약도·유형, 최소 합승 인원 |
| `output/tables/` | 보고서 표의 원수치 (t1~t22, summary_*.json, 실행 로그). 취약지역 120곳 명단은 `t12_vulnerable_120.csv`, 시뮬레이션 배출량(kg/일)과 감축률 분모(기준배출_kg일)는 `t10_yeoncheon_detail.csv` |
| `output/figures/` | 그림 fig1~fig8 (보고서 그림 1 = fig1, 2 = fig6, 3 = fig8) |

원자료(약 300MB)는 용량 때문에 올리지 않았고 `s00_download.py`로 다시 받습니다.

## 원자료 (`data/raw/`, 모두 로그인 없이 다운로드)

| 파일 | 데이터 | 출처 |
| --- | --- | --- |
| `sgis_boundary_stats.zip` → `sgis/` | 국가데이터처 SGIS 행정구역 통계 및 경계 (경계 2025.2Q, 통계 2024) | https://www.data.go.kr/data/15129688/fileData.do |
| `hira_2026_06.zip` → `hira_hospitals_2026_06.xlsx`, `hira_departments_2026_06.xlsx` | 건강보험심사평가원 전국 병의원 및 약국 현황 2026.6 (병원정보서비스, 진료과목정보) | https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925 |
| `bus_stops_20251031.csv` | 국토교통부 전국 버스정류장 위치정보 | https://www.data.go.kr/data/15067528/fileData.do |
| `pop_20260831.csv` | 행정안전부 행정동 성·연령별 주민등록 인구 (현재 분석에는 미사용, 검증용) | https://www.data.go.kr/data/15097972/fileData.do |

SGIS zip에서는 `bnd_dong_*`, `bnd_sigungu_*.dbf`, 통계 CSV, 코드집 xlsx만 `sgis/`에 풀어 씁니다.
원자료는 용량이 커서(약 300MB) 저장소에 올리지 않는 것을 권장합니다(`.gitignore`).

## 단계

| 스크립트 | 내용 | 성격 | 산출물 |
| --- | --- | --- | --- |
| `s01_indicators.py` | 읍면동 고령비율, 병원·종합병원 거리, 정류장 밀도 | 실증 | `data/processed/gg_dong*.{csv,gpkg}` |
| `s02_vulnerability.py` | 취약도 지수, 민감도, K-평균 유형화, 그림 1~4 | 실증 | `output/tables/t1~t4`, `summary_stage1.json` |
| `s02b_ml_validation.py` | 머신러닝 유형화 검증·설명: 가우시안 혼합·계층 군집 비교, 부트스트랩 200회 안정성, 랜덤포레스트 대리모델 순열 중요도, PCA 가중치, 그림 7 | 실증 (AI 방법론) | `t13~t16`, `summary_ml_validation.json` |
| `s03_breakeven.py` | 취약지역별 최소 합승 인원, 거리 구간 기준표, 그림 5 | 시뮬레이션 | `t5~t7`, `summary_stage2_breakeven.json` |
| `s04_yeoncheon_sim.py` | 연천 가상 수요 몬테카를로 (예약 비율 × 참여율 격자), 그림 6 | 시뮬레이션 | `t8~t9`, `summary_stage2_sim.json` |
| `s05_scenarios.py` | 연천 시뮬레이션을 취약 읍면 2곳 이상인 15개 시군으로 일반화, 시군당 400개 무작위 운영조건 × 30일 → 6,000행 시나리오 데이터셋 | 시뮬레이션 | `t17_scenarios.csv`, `summary_scenarios.json` |
| `s06_surrogate.py` | XGBoost·랜덤포레스트 대리모델, 시군 단위 GroupKFold, SHAP, 시군별 운영 추천과 직접 시뮬레이션 대조 | 시뮬레이션 (AI 방법론) | `t18~t22`, `fig8_shap.png`, `summary_surrogate.json` |

가정값은 모두 `src/config.py`의 `ASSUMPTIONS`, `SCENARIOS`, `EF_RANGE`에 모여 있습니다. 배출계수는 KTDB 차종·속도별 산출식(40km/h)과 2023 국가 전력배출계수·PV5 공인전비로 정했고(근거는 config.py 주석), 기본·적극 전환율은 임시값입니다.
