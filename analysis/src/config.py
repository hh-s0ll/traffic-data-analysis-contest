"""분석 공통 설정: 경로, 가정값, 그림 글꼴.

가정값(ASSUMPTIONS)은 공개데이터로 확인할 수 없는 값이다. 보고서에 "가정"으로 명시하고 민감도 분석을 함께 제시한다.
"""
from pathlib import Path

import matplotlib

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
SGIS = RAW / "sgis"
PROCESSED = ROOT / "data" / "processed"
FIG = ROOT / "output" / "figures"
TABLE = ROOT / "output" / "tables"
for p in (PROCESSED, FIG, TABLE):
    p.mkdir(parents=True, exist_ok=True)

# 원자료 파일
F_BOUNDARY = SGIS / "bnd_dong_00_2025_2Q.shp"  # 국가데이터처 SGIS 2025년 2분기 행정동 경계 (EPSG:5179)
F_SIGUNGU = SGIS / "bnd_sigungu_00_2025_2Q.dbf"
F_POP_AGE = SGIS / "2025년기준_2024년_성연령별인구.csv"  # SGIS 2024년 성·연령별 인구 (행정동)
F_POP_TOTAL = SGIS / "2025년기준_2024년_인구총괄(총인구).csv"
F_BUS = RAW / "bus_stops_20251031.csv"  # 국토교통부 전국 버스정류장 위치정보 2025-10-31
F_HOSP = RAW / "hira_hospitals_2026_06.xlsx"  # 건강보험심사평가원 병원정보서비스 2026.6
F_DEPT = RAW / "hira_departments_2026_06.xlsx"  # 건강보험심사평가원 의료기관별상세정보 진료과목정보 2026.6

GG_PREFIX = "31"  # SGIS 행정구역코드에서 경기도

# 병원 구분 (건강보험심사평가원 종별코드명)
HOSPITAL_LEVEL = ["상급종합", "종합병원", "병원", "보건의료원"]  # 병원급 이상 (요양·정신·치과·한방 제외)
# 병원급 이상 중 내과 전문의가 1명 이상인 곳만 "병원" 목적지로 본다 (재활·전문병원 제외 효과)
REQUIRE_DEPT = "내과"
GENERAL_LEVEL = ["상급종합", "종합병원"]

# 가정값 — 공개데이터로 확인 불가. 보고서에 가정으로 명시
ASSUMPTIONS = {
    "road_factor": 1.3,  # 직선거리 → 도로거리 보정 (민감도: 1.2~1.5)
    # 배출계수 (kgCO2/km, 운행 단계). 근거: 한국교통연구원 KTDB「View Transport 통행지표 설명자료 - 이산화탄소배출량」
    # Version 3.0 (2026.4) 표 2의 차종·연료별 속도 산출식(2021 승인 국가 도로수송 배출계수 기반)을 평균 40km/h에 적용.
    "car_kg_per_km": 0.171,  # 승용 중형 휘발유: 1446.3728 × 40^-0.5793 = 170.7 g/km
    "van_kg_per_km": 0.227,  # 소형 승합(경유): 표에 승합 소형이 없어 같은 크기의 화물 소형 경유로 대신: 1250.4831 × 40^-0.4630 = 226.6 g/km
    # 전기 승합: 2023 국가 전력배출계수 0.4173 kgCO2eq/kWh ÷ 기아 PV5 패신저 7인승 복합전비 4.4 km/kWh × 충전손실 1.1
    # 충전손실 1.1은 인증 전비(배터리 기준)에 충전 과정 손실 약 10%를 더한 가정값이다 (출처 없음, 보고서에 가정으로 표시)
    # (기본 차량을 운전자 포함 7인승으로 두었으므로 5인승 4.5 km/kWh 대신 7인승 값을 쓴다)
    "ev_van_kg_per_km": 0.104,
    "detour_factor": 1.25,  # 공동배차 우회계수
    "village_km": 8.0,  # 마을 경유 추가거리
    "van_capacity": 6,  # 승객 좌석. 7인승 승합(운전석 제외), 2024년 연천 도입 보도 기준
    "van_capacity_alt": 11,
}

# 차량 전환율 시나리오 (기획안 5장). 보수만 근거 있음
SCENARIOS = {
    "보수": 0.213,  # 수원시정연구원 똑버스 이용자 조사: 도입 전 자가용 주이용 21.3%
    "기본": 0.40,  # 임시값 (팀 확정 필요)
    "적극": 0.60,  # 임시값 (팀 확정 필요)
}

# 그림 설정
matplotlib.use("Agg")
matplotlib.rcParams["font.family"] = "Malgun Gothic"
matplotlib.rcParams["axes.unicode_minus"] = False
matplotlib.rcParams["figure.dpi"] = 150
matplotlib.rcParams["savefig.bbox"] = "tight"

COLORS = {
    "forest": "#1F5D3C",
    "leaf": "#3F8F5F",
    "mist": "#EAF2EC",
    "clay": "#B4531F",
    "sand": "#E8DCC8",
    "ink": "#14231B",
    "muted": "#6B7A71",
}

# 배출계수 불확실성 범위 (몬테카를로에서 균등분포로 추출)
EF_RANGE = {
    "car": (0.142, 0.207),  # KTDB 승용 소형~대형 휘발유, 40km/h
    "van": (0.204, 0.259),  # KTDB 화물 소형 경유, 50~30km/h
    # 기아 공식 제원 PV5 패신저 7인승(2-2-3) 정부 인증 전비: 도심 5.1, 고속 3.7 km/kWh
    "ev": (0.090, 0.135),  # 0.4173/5.1×1.1 ~ 0.4541/3.7×1.1 (전력계수 2023 ~ 2020~2022 평균)
}
