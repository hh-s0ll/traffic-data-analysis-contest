"""1단계-①: 경기도 읍·면·동 지표 만들기 (실증 분석, 분석 1 근사)

지표
- 고령인구 비율 (65세 이상 / 총인구), 75세 이상 비율       : SGIS 2024 성·연령별 인구
- 가장 가까운 병원급 이상 / 종합병원급까지 도로 근사거리(km) : 심평원 병원정보서비스 좌표, 직선거리 × 도로보정
- 버스정류장 밀도 (개/km²), 인구 천 명당 정류장 수           : 국토교통부 버스정류장 위치

대표점: 읍면동 안 정류장이 3개 이상이면 정류장 좌표의 중앙값(사람이 사는 곳에 가까움), 아니면 경계 내부 대표점.
"""
import geopandas as gpd
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

from config import (ASSUMPTIONS, F_BOUNDARY, F_BUS, F_DEPT, F_HOSP, REQUIRE_DEPT, F_POP_AGE, F_POP_TOTAL, F_SIGUNGU,
                    GENERAL_LEVEL, GG_PREFIX, HOSPITAL_LEVEL, PROCESSED)

CRS = "EPSG:5179"  # 미터 단위 투영좌표


def load_boundary():
    g = gpd.read_file(F_BOUNDARY)
    g = g[g["ADM_CD"].astype(str).str.startswith(GG_PREFIX)].copy()
    g["ADM_CD"] = g["ADM_CD"].astype(str)
    g["SIGUNGU_CD"] = g["ADM_CD"].str[:5]
    sg = gpd.read_file(F_SIGUNGU, ignore_geometry=True)
    sg["SIGUNGU_CD"] = sg["SIGUNGU_CD"].astype(str)
    g = g.merge(sg[["SIGUNGU_CD", "SIGUNGU_NM"]], on="SIGUNGU_CD", how="left")
    # 시 단위(구 합침) 이름: "수원시 장안구" → "수원시"
    g["SI_NM"] = g["SIGUNGU_NM"].str.split().str[0]
    g["adm_type"] = np.select(
        [g["ADM_NM"].str.endswith("읍"), g["ADM_NM"].str.endswith("면")], ["읍", "면"], default="동"
    )
    g = g.to_crs(CRS)
    g["area_km2"] = g.geometry.area / 1e6
    return g


def load_population():
    def read(path, codes):
        d = pd.read_csv(path, encoding="cp949", dtype=str)
        d = d[d["행정구역코드"].str.len().eq(8) & d["행정구역코드"].str.startswith(GG_PREFIX)]
        d = d[d["통계항목"].isin(codes)]
        # 'N/A' 는 비밀보호 처리(5 미만) → 2.5 로 대체하지 않고 0 으로 두되 개수를 기록
        d["na"] = d["통계값"].eq("N/A")
        d["v"] = pd.to_numeric(d["통계값"], errors="coerce").fillna(0)
        return d

    total = read(F_POP_TOTAL, ["to_in_001"]).set_index("행정구역코드")["v"].rename("pop")
    age = read(F_POP_AGE, [f"in_age_{i:03d}" for i in range(14, 22)])
    p65 = age.groupby("행정구역코드")["v"].sum().rename("pop65")
    p75 = age[age["통계항목"].isin([f"in_age_{i:03d}" for i in range(16, 22)])].groupby("행정구역코드")["v"].sum().rename("pop75")
    na = age.groupby("행정구역코드")["na"].sum().rename("age_na_cells")
    # 행이 아예 없는 65세 이상 칸 (0명 또는 비밀보호로 생략된 1~4명일 수 있음)
    missing = (8 - age.groupby("행정구역코드").size()).rename("age_missing_cells")
    return pd.concat([total, p65, p75, na, missing], axis=1).fillna(0)


def load_bus():
    b = pd.read_csv(F_BUS, encoding="cp949")
    b = b.dropna(subset=["위도", "경도"])
    # 경기도와 경계를 맞댄 지역 정류장도 함께 (경계 부근 누락 방지)
    b = b[b["위도"].between(36.8, 38.4) & b["경도"].between(126.3, 127.9)]
    return gpd.GeoDataFrame(b, geometry=gpd.points_from_xy(b["경도"], b["위도"]), crs="EPSG:4326").to_crs(CRS)


def load_hospitals():
    h = pd.read_excel(F_HOSP)
    h = h.dropna(subset=["좌표(X)", "좌표(Y)"])
    h = h[h["좌표(Y)"].between(36.5, 38.6) & h["좌표(X)"].between(126.0, 128.3)]  # 경기와 인접 시도
    dept = pd.read_excel(F_DEPT)
    ok = dept[(dept["진료과목코드명"] == REQUIRE_DEPT) & (dept["과목별 전문의수"] >= 1)]["암호화요양기호"]
    h["has_dept"] = h["암호화요양기호"].isin(set(ok))
    return gpd.GeoDataFrame(h, geometry=gpd.points_from_xy(h["좌표(X)"], h["좌표(Y)"]), crs="EPSG:4326").to_crs(CRS)


def nearest_km(points: gpd.GeoSeries, targets: gpd.GeoDataFrame):
    xy = np.c_[targets.geometry.x, targets.geometry.y]
    tree = cKDTree(xy)
    d, idx = tree.query(np.c_[points.x, points.y])
    return d / 1000, idx


def main():
    g = load_boundary()
    pop = load_population()
    g = g.merge(pop, left_on="ADM_CD", right_index=True, how="left")

    bus = load_bus()
    joined = gpd.sjoin(bus[["geometry"]], g[["ADM_CD", "geometry"]], predicate="within")
    g["stops"] = g["ADM_CD"].map(joined.groupby("ADM_CD").size()).fillna(0).astype(int)

    # 대표점
    rep = g.geometry.representative_point()
    stop_xy = joined.assign(x=joined.geometry.x, y=joined.geometry.y).groupby("ADM_CD")[["x", "y"]].median()
    use_stops = g["ADM_CD"].map(g.set_index("ADM_CD")["stops"]) >= 3
    xs = np.where(use_stops, g["ADM_CD"].map(stop_xy["x"]), rep.x)
    ys = np.where(use_stops, g["ADM_CD"].map(stop_xy["y"]), rep.y)
    pts = gpd.GeoSeries(gpd.points_from_xy(xs, ys), crs=CRS)
    g["rep_x"], g["rep_y"] = xs, ys
    g["rep_from_stops"] = use_stops.values

    hosp = load_hospitals()
    rf = ASSUMPTIONS["road_factor"]
    for col, levels in [("hosp", HOSPITAL_LEVEL), ("general", GENERAL_LEVEL)]:
        t = hosp[hosp["종별코드명"].isin(levels) & hosp["has_dept"]].reset_index(drop=True)
        print(f"{col}: 대상 의료기관 {len(t)}곳 (내과 전문의 1명 이상)")
        d, idx = nearest_km(pts, t)
        g[f"dist_{col}_km"] = d * rf
        g[f"nearest_{col}"] = t.loc[idx, "요양기관명"].values
        g[f"nearest_{col}_sgg"] = t.loc[idx, "시군구코드명"].values
    clinic = hosp[hosp["종별코드명"].isin(["의원", "보건소", "보건지소", "보건진료소"])].reset_index(drop=True)
    g["dist_primary_km"] = nearest_km(pts, clinic)[0] * rf

    g["elderly_ratio"] = g["pop65"] / g["pop"].where(g["pop"] > 0)
    g["old75_ratio"] = g["pop75"] / g["pop"].where(g["pop"] > 0)
    g["stop_density"] = g["stops"] / g["area_km2"]
    g["stops_per_1k"] = g["stops"] / (g["pop"].where(g["pop"] > 0) / 1000)

    g.to_file(PROCESSED / "gg_dong.gpkg", driver="GPKG")
    cols = ["ADM_CD", "SIGUNGU_NM", "SI_NM", "ADM_NM", "adm_type", "area_km2", "pop", "pop65", "pop75", "age_na_cells", "age_missing_cells",
            "elderly_ratio", "old75_ratio", "stops", "stop_density", "stops_per_1k", "dist_hosp_km", "nearest_hosp",
            "dist_general_km", "nearest_general", "dist_primary_km", "rep_from_stops"]
    g[cols].to_csv(PROCESSED / "gg_dong_indicators.csv", index=False, encoding="utf-8-sig")

    print(f"경기도 읍면동 {len(g)}곳 {g["adm_type"].value_counts().to_dict()}")
    print(f"인구 결측 {g['pop'].isna().sum()}곳, 정류장 0개 {int((g.stops==0).sum())}곳, 대표점=정류장 중앙값 {int(g.rep_from_stops.sum())}곳")
    print(g[["elderly_ratio", "stop_density", "dist_hosp_km", "dist_general_km"]].describe().round(3).to_string())


if __name__ == "__main__":
    main()
