"""2단계-③: 시군 단위 운영 시나리오 데이터셋 만들기 (정책 시뮬레이션 → AI 대리모델 학습용)

연천 시뮬레이션(s04)을 취약 읍면이 2곳 이상인 경기도 15개 시군으로 일반화한다.
실데이터: 각 시군 읍·면의 65세 이상 인구와 대표점(SGIS·정류장), 가장 가까운 종합병원(심평원).
차고지는 시군에서 인구가 가장 많은 읍·면으로 둔다.

시나리오마다 운영조건을 무작위로 뽑고 30일을 시뮬레이션해 한 행으로 저장한다.
  예약자 비율(평일 하루 65세 이상 대비) 0.25~2% (로그 균등), 참여율 10~50%, 오전 진료 집중도 40~80%
  차량 전환율 15~65%, 승용차 운행 계수 0.7~2.0, 차종 경유/전기, 승객 좌석 6/11, 허용 대기 45/60/90분
  배차 규칙 A(4명 이상 출발)/B(묶음별 손익분기를 넘을 때만), 배출계수는 EF_RANGE 안에서 균등 추출
결과: 수송률, 평균 최대대기, 필요 차량(95번째 백분위), 하루 차량km·차량시간, 기준 대비 탄소 변화율
값들은 모두 가정 조건의 시뮬레이션 결과이며 실측이 아니다.
"""
import json
from functools import lru_cache

import geopandas as gpd
import numpy as np
import pandas as pd

from config import ASSUMPTIONS as A, EF_RANGE, GENERAL_LEVEL, PROCESSED, TABLE
from s01_indicators import load_hospitals

N_SCEN = 400  # 시군당 시나리오 수
DAYS = 30
SEED = 2026
SPEED_KMH, DWELL_MIN, BUFFER, CLINIC_AFTER = 40, 2, 10, 60
SLOTS = np.arange(9 * 60, 15 * 60 + 31, 30)
RF = A["road_factor"]


def build_areas():
    g = gpd.read_file(PROCESSED / "gg_dong_scored.gpkg")
    r = g[g["adm_type"].isin(["읍", "면"])].copy()
    counts = r.groupby("SI_NM")["vulnerable"].sum()
    hosp = load_hospitals()
    gen = hosp[hosp["종별코드명"].isin(GENERAL_LEVEL) & hosp["has_dept"]].reset_index(drop=True)
    hxy = np.c_[gen.geometry.x, gen.geometry.y]
    areas = {}
    for si in counts[counts >= 2].index:
        v = r[r["SI_NM"] == si].reset_index(drop=True)
        xy = np.c_[v["rep_x"], v["rep_y"]]
        near = [int(np.argmin(np.hypot(hxy[:, 0] - x, hxy[:, 1] - y))) for x, y in xy]
        depot = int(v["pop"].idxmax())
        hosp_ids = sorted(set(near))
        pts = np.vstack([xy, hxy[hosp_ids]])  # 마을 0..n-1, 병원 n..
        hidx = {h: len(v) + i for i, h in enumerate(hosp_ids)}
        D = np.hypot(pts[:, None, 0] - pts[None, :, 0], pts[:, None, 1] - pts[None, :, 1]) / 1000 * RF
        w = v["pop65"] / v["pop65"].sum()
        areas[si] = dict(
            n=len(v), pop65=v["pop65"].values, hosp=[hidx[h] for h in near], depot=depot, D=D,
            feat=dict(
                시군=si, 읍면수=len(v), 고령인구=float(v["pop65"].sum()),
                고령고립형비율=float((v["cluster"] == "고령 고립형").mean()),
                평균고령비율=float((v["elderly_ratio"] * w).sum()),
                평균종합병원거리km=float((D[np.arange(len(v)), [hidx[h] for h in near]] * w).sum()),
                평균정류장밀도=float((v["stop_density"] * w).sum()),
                평균차고지거리km=float((D[depot, :len(v)] * w).sum()),
            ),
        )
    return areas


AREAS = build_areas()


@lru_cache(maxsize=None)
def route(si, stops, h):
    """차고지 → 정류장들(stops) → 병원 h 최단 편도 거리. 부분집합 동적계획."""
    a = AREAS[si]
    D, dep, s = a["D"], a["depot"], list(stops)
    best = {(1 << i, i): D[dep, x] for i, x in enumerate(s)}
    for mask in range(1, 1 << len(s)):
        for i in range(len(s)):
            if (mask, i) not in best:
                continue
            for j in range(len(s)):
                if not mask & (1 << j):
                    k, val = (mask | (1 << j), j), best[(mask, i)] + D[s[i], s[j]]
                    if val < best.get(k, 1e18):
                        best[k] = val
    full = (1 << len(s)) - 1
    return min(best[(full, i)] + D[s[i], h] for i in range(len(s)))


def simulate(si, c, rng):
    a = AREAS[si]
    D = a["D"]
    w = np.where(SLOTS < 12 * 60, c["morning"] / 6, (1 - c["morning"]) / 8)
    w = w / w.sum()
    tot_base = tot = n_all = pooled = vkm = vh = 0.0
    waits, fleets = [], []
    for _ in range(DAYS):
        people = []
        for i in range(a["n"]):
            for t in rng.choice(SLOTS, size=rng.poisson(a["pop65"][i] * c["rate"] * c["part"]), p=w):
                people.append((i, a["hosp"][i], int(t)))
        car_kg = lambda b: sum(c["conv"] * 2 * D[p[0], p[1]] * c["carfac"] * c["car_ef"] for p in b)
        base = car_kg(people)
        day_total, intervals = 0.0, []
        for h in {p[1] for p in people}:
            cur, bundles = [], []
            for p in sorted([p for p in people if p[1] == h], key=lambda p: p[2]):
                if cur and p[2] - cur[0][2] + BUFFER <= c["wait"] and len(cur) < c["cap"]:
                    cur.append(p)
                else:
                    cur = [p]
                    bundles.append(cur)
            for b in bundles:
                stops = tuple(sorted({p[0] for p in b}))
                one = route(si, stops, h)
                van = 2 * one * c["van_ef"]
                go = len(b) >= 4 if c["rule"] == "A" else van < car_kg(b)
                if go:
                    day_total += van
                    pooled += len(b)
                    vkm += 2 * one
                    drive = one / SPEED_KMH * 60 + DWELL_MIN * len(stops)
                    s0 = b[0][2] - BUFFER - drive
                    s1 = b[-1][2] + CLINIC_AFTER + drive
                    intervals.append((s0, s1))
                    vh += (s1 - s0) / 60
                    waits.append(b[-1][2] - (b[0][2] - BUFFER))
                else:
                    day_total += car_kg(b)
        ev = sorted([(s, 1) for s, _ in intervals] + [(e, -1) for _, e in intervals])
        cur_n = peak = 0
        for _, d in ev:
            cur_n += d
            peak = max(peak, cur_n)
        fleets.append(peak)
        tot_base += base
        tot += day_total
        n_all += len(people)
    return dict(
        참여자_일평균=n_all / DAYS, 수송률=pooled / n_all if n_all else 0.0,
        최대대기_분=float(np.mean(waits)) if waits else 0.0,
        필요차량=float(np.percentile(fleets, 95)), 차량km_일=vkm / DAYS, 차량시간_일=vh / DAYS,
        기준배출_kg일=tot_base / DAYS,
        탄소변화율=100 * (tot - tot_base) / tot_base if tot_base else 0.0,
    )


def sample_condition(rng):
    fuel = rng.choice(["경유", "전기"])
    return dict(
        rate=float(10 ** rng.uniform(np.log10(0.0025), np.log10(0.02))), part=float(rng.uniform(0.1, 0.5)),
        morning=float(rng.uniform(0.4, 0.8)), conv=float(rng.uniform(0.15, 0.65)), carfac=float(rng.uniform(0.7, 2.0)),
        fuel=str(fuel), cap=int(rng.choice([6, 11])), wait=int(rng.choice([45, 60, 90])), rule=str(rng.choice(["A", "B"])),
        car_ef=float(rng.uniform(*EF_RANGE["car"])),
        van_ef=float(rng.uniform(*(EF_RANGE["van"] if fuel == "경유" else EF_RANGE["ev"]))),
    )


def run_one(si, c, seed):
    return simulate(si, c, np.random.default_rng(seed))


def main():
    rng = np.random.default_rng(SEED)
    rows = []
    for k, si in enumerate(AREAS):
        for j in range(N_SCEN):
            c = sample_condition(rng)
            out = run_one(si, c, SEED + 100000 * k + j)
            rows.append({**AREAS[si]["feat"], **c, **out})
        print(f"{si}: {N_SCEN}개 완료", flush=True)
    df = pd.DataFrame(rows)
    df.to_csv(TABLE / "t17_scenarios.csv", index=False, encoding="utf-8-sig")
    meta = {"시군": list(AREAS), "시나리오수": len(df), "시군당": N_SCEN, "일수": DAYS,
            "시군특성": [AREAS[s]["feat"] for s in AREAS]}
    (TABLE / "summary_scenarios.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2, default=float), encoding="utf-8")
    print(df.describe().round(3).T.to_string())


if __name__ == "__main__":
    main()
