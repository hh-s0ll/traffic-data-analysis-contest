"""2단계-②: 연천군 가상 수요 공동배차 몬테카를로 시뮬레이션 (정책 시뮬레이션, 분석 3)

실데이터: 연천 10개 읍면의 65세 이상 인구(SGIS 2024), 읍면 대표점, 가장 가까운 종합병원 위치(심평원 2026.6)
가정: 평일 하루 종합병원 예약자 비율, 예약 연계 참여율, 차량 전환율, 승용차 운행 계수, 배출계수, 차량 정원

하루 절차
 1. 읍면별 참여자 수 ~ 포아송(65세 이상 × 예약자 비율 × 참여율), 진료 시각 09:00~15:30 (오전 60%)
 2. 병원별 시간순 그리디 묶기 (첫 진료와 마지막 진료 차 + 도착 여유 10분 ≤ 60분, 정원 이하)
 3. 경로: 차고지(전곡읍) → 마을들 → 병원 (최단 순서), 마지막 진료 60분 뒤 같은 경로로 귀가.
    차량은 병원에서 기다린다고 보고 차량 점유시간과 필요 대수를 계산한다.
 4. 기준선: 참여자 중 전환율만큼이 승용차로 병원을 왕복. 승용차 운행거리 = 2 × 병원거리 × 승용차 운행 계수
    (운행 계수 1.0 = 환자 1명당 승용차 왕복 1회, 0.7 = 여러 환자가 한 차에 동승, 2.0 = 보호자가 내려주고 귀가했다가 다시 데리러 오는 집-병원 2회 왕복)
    감축률의 분모는 이 기준선 배출이다. 전환되지 않은 이용자의 기존 이동 배출은 변하지 않는다고 본다.
 5. 배차 규칙
    A      : 정원 안에서 4명 이상이면 출발 (데모 기본값)
    B      : 그 묶음의 공동배차 배출 < 승용차 대체 배출 (평가에 쓰는 실제 전환율로 판단, 이상적 기준)
    B계획  : 계획 전환율 40%로 판단한 뒤 실제 전환율로 평가 (계획과 현실이 다를 때의 강건성)
    B여유  : 계획 전환율 40%, 공동배차 배출 × 1.3 < 승용차 대체 배출 일 때만 출발 (안전 여유)
    출발하지 않은 묶음의 참여자는 기존 방식으로 이동한다.
 6. 같은 수요(공통 난수)에 모든 규칙을 적용하는 짝지은 비교. 난수 시드 5개 × 100일.
"""
import itertools
import json
from functools import lru_cache

import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import TwoSlopeNorm

from config import ASSUMPTIONS as A, COLORS, EF_RANGE, FIG, GENERAL_LEVEL, PROCESSED, SCENARIOS, TABLE
from s01_indicators import load_hospitals

SEEDS = [11, 22, 33, 44, 55]
DAYS_PER_SEED = 100
RATES = [0.0025, 0.005, 0.01, 0.02]  # 평일 하루 65세 이상 중 종합병원 예약자 비율 (가정)
PARTS = [0.1, 0.2, 0.3, 0.5]  # 예약 연계 참여율 (가정)
WAIT, BUFFER, CLINIC_AFTER = 60, 10, 60  # 분
SPEED_KMH, DWELL_MIN = 40, 2
CAP_MAIN, CAP_ALT = A["van_capacity"], A["van_capacity_alt"]  # 승객 좌석: 7인승 승합(6석) / 11석 비교
PLAN_CONV, MARGIN = 0.40, 1.3
SLOTS = np.arange(9 * 60, 15 * 60 + 31, 30)
SLOT_W = np.where(SLOTS < 12 * 60, 0.6 / 6, 0.4 / 8)
SLOT_W = SLOT_W / SLOT_W.sum()
RF = A["road_factor"]
EF = {"경유": A["van_kg_per_km"], "전기": A["ev_van_kg_per_km"]}


def setup():
    g = gpd.read_file(PROCESSED / "gg_dong_scored.gpkg")
    y = g[g["SI_NM"] == "연천군"].copy()
    hosp = load_hospitals()
    gen = hosp[hosp["종별코드명"].isin(GENERAL_LEVEL) & hosp["has_dept"]].reset_index(drop=True)
    xy = np.c_[gen.geometry.x, gen.geometry.y]
    vill = {}
    for _, r in y.iterrows():
        j = int(np.argmin(np.hypot(xy[:, 0] - r["rep_x"], xy[:, 1] - r["rep_y"])))
        vill[r["ADM_NM"]] = dict(x=r["rep_x"], y=r["rep_y"], pop65=r["pop65"], hosp=gen.loc[j, "요양기관명"],
                                 hx=xy[j, 0], hy=xy[j, 1])
    return vill, (vill["전곡읍"]["x"], vill["전곡읍"]["y"])


VILL, DEPOT = setup()


def km(a, b):
    return np.hypot(a[0] - b[0], a[1] - b[1]) / 1000 * RF


def pos(n):
    return (VILL[n]["x"], VILL[n]["y"])


HPOS = {v["hosp"]: (v["hx"], v["hy"]) for v in VILL.values()}
HOSP_KM = {n: km(pos(n), HPOS[v["hosp"]]) for n, v in VILL.items()}


@lru_cache(maxsize=None)
def route(stops: frozenset, hosp: str):
    """차고지 → 정류장들 → 병원 최단 편도 거리(km). 부분집합 동적계획, 정류장 최대 10곳."""
    s = list(stops)
    H = HPOS[hosp]
    best = {(1 << i, i): km(DEPOT, pos(a)) for i, a in enumerate(s)}
    for mask in range(1, 1 << len(s)):
        for i in range(len(s)):
            if (mask, i) not in best:
                continue
            for j in range(len(s)):
                if not mask & (1 << j):
                    key, v = (mask | (1 << j), j), best[(mask, i)] + km(pos(s[i]), pos(s[j]))
                    if v < best.get(key, 1e18):
                        best[key] = v
    full = (1 << len(s)) - 1
    return min(best[(full, i)] + km(pos(s[i]), H) for i in range(len(s)))


def make_day(rng, rate, part):
    people = []
    for n, v in VILL.items():
        for t in rng.choice(SLOTS, size=rng.poisson(v["pop65"] * rate * part), p=SLOT_W):
            people.append((n, v["hosp"], int(t)))
    return people


def bundle(people, cap):
    out = []
    for h in {p[1] for p in people}:
        cur = []
        for p in sorted([p for p in people if p[1] == h], key=lambda p: p[2]):
            if cur and p[2] - cur[0][2] + BUFFER <= WAIT and len(cur) < cap:
                cur.append(p)
            else:
                cur = [p]
                out.append(cur)
    return out


def evaluate(people, bundles, conv, rule, van_ef, carfac, car_ef=None):
    """하루 결과. conv 는 실제(평가) 전환율."""
    car_ef = A["car_kg_per_km"] if car_ef is None else car_ef
    car_kg = lambda b, c: sum(c * 2 * HOSP_KM[p[0]] * carfac * car_ef for p in b)
    base = car_kg(people, conv)
    total, pooled, vkm, vhours, waits, departures, intervals = 0.0, 0, 0.0, 0.0, [], 0, []
    for b in bundles:
        stops = frozenset(p[0] for p in b)
        one_way = route(stops, b[0][1])
        rk = 2 * one_way
        van = rk * van_ef
        if rule == "A":
            go = len(b) >= 4
        elif rule == "B":
            go = van < car_kg(b, conv)
        elif rule == "B계획":
            go = van < car_kg(b, PLAN_CONV)
        else:  # B여유
            go = van * MARGIN < car_kg(b, PLAN_CONV)
        if go:
            total += van
            pooled += len(b)
            vkm += rk
            departures += 1
            drive_min = one_way / SPEED_KMH * 60 + DWELL_MIN * len(stops)
            arrive = b[0][2] - BUFFER
            start, end = arrive - drive_min, b[-1][2] + CLINIC_AFTER + drive_min
            intervals.append((start, end))
            vhours += (end - start) / 60
            waits.append(b[-1][2] - arrive)
        else:
            total += car_kg(b, conv)
    # 필요 차량 대수 = 하루 중 동시에 운행·대기 중인 차량 수의 최댓값
    ev = sorted([(s, 1) for s, _ in intervals] + [(e, -1) for _, e in intervals])
    cur = peak = 0
    for _, d in ev:
        cur += d
        peak = max(peak, cur)
    return dict(base=base, total=total, n=len(people), pooled=pooled, vkm=vkm, vhours=vhours,
                maxwait=max(waits) if waits else np.nan, departures=departures, fleet=peak)


def run(rate, part, cap, combos):
    """combos: [(전환율이름, 연료, 규칙, 운행계수)] — 같은 수요로 짝지어 평가"""
    recs = []
    for seed in SEEDS:
        rng = np.random.default_rng(seed * 1000 + int(rate * 1e4) + int(part * 100))
        for d in range(DAYS_PER_SEED):
            people = make_day(rng, rate, part)
            bundles = bundle(people, cap)
            for scen, fuel, rule, carfac in combos:
                r = evaluate(people, bundles, SCENARIOS[scen], rule, EF[fuel], carfac)
                recs.append(dict(seed=seed, day=d, scenario=scen, fuel=fuel, rule=rule, carfac=carfac, **r))
    return pd.DataFrame(recs)


def summarize(df, keys):
    def f(g):
        base, tot = g["base"].sum(), g["total"].sum()
        daily = 100 * (g["total"] - g["base"]) / g["base"].where(g["base"] > 0)
        seed_chg = g.groupby("seed").apply(lambda s: 100 * (s["total"].sum() - s["base"].sum()) / s["base"].sum(),
                                           include_groups=False)
        return pd.Series({
            "참여자_일평균": g["n"].mean(),
            "수송률": g["pooled"].sum() / max(g["n"].sum(), 1),
            "기준배출_kg일": base / len(g), "배출_kg일": tot / len(g),
            "변화율": 100 * (tot - base) / base if base else 0.0,
            "변화율_시드최소": seed_chg.min(), "변화율_시드최대": seed_chg.max(),
            "일별변화_p5": np.nanpercentile(daily, 5), "일별변화_p95": np.nanpercentile(daily, 95),
            "배출증가일_비율": float((g["total"] > g["base"] + 1e-9).mean()),
            "출발편수_일평균": g["departures"].mean(), "출발한_날_비율": float((g["departures"] > 0).mean()),
            "차량km_일": g["vkm"].mean(), "차량시간_일": g["vhours"].mean(),
            "필요차량_p95": np.percentile(g["fleet"], 95), "최대대기_분": g["maxwait"].mean(),
            "차량1대당_시간": g["vhours"].mean() / max(np.percentile(g["fleet"], 95), 1),
        })
    return df.groupby(keys).apply(f, include_groups=False).reset_index()


def main():
    # (1) 격자: 정원 6석, 운행계수 1.0
    grid_combos = [(s, f, r, 1.0) for s in ("보수", "기본") for f in ("경유", "전기") for r in ("A", "B")]
    grid = []
    for rate, part in itertools.product(RATES, PARTS):
        s = summarize(run(rate, part, CAP_MAIN, grid_combos), ["scenario", "fuel", "rule", "carfac"])
        grid.append(s.assign(rate=rate, part=part))
    grid = pd.concat(grid)
    grid.round(4).to_csv(TABLE / "t8_yeoncheon_grid.csv", index=False, encoding="utf-8-sig")

    # (2) 대표 조건 상세: 예약자 1%, 참여율 30%
    detail = []
    combos = ([(s, f, r, 1.0) for s in ("보수", "기본") for f in ("경유", "전기") for r in ("A", "B", "B계획", "B여유")]
              + [(s, f, "B", c) for s in ("보수", "기본") for f in ("경유", "전기") for c in (0.7, 2.0)])
    for cap in (CAP_MAIN, CAP_ALT):
        s = summarize(run(0.01, 0.3, cap, combos), ["scenario", "fuel", "rule", "carfac"])
        detail.append(s.assign(cap=cap))
    detail = pd.concat(detail)
    detail.round(4).to_csv(TABLE / "t10_yeoncheon_detail.csv", index=False, encoding="utf-8-sig")

    ef_unc = ef_uncertainty()
    ef_unc.round(3).to_csv(TABLE / "t11_ef_uncertainty.csv", index=False, encoding="utf-8-sig")

    villages = pd.DataFrame([{"읍면": n, "pop65": v["pop65"], "병원": v["hosp"], "병원거리km": round(HOSP_KM[n], 1),
                              "차고지거리km": round(km(DEPOT, pos(n)), 1)} for n, v in VILL.items()])
    villages.to_csv(TABLE / "t9_yeoncheon_villages.csv", index=False, encoding="utf-8-sig")

    figure(grid)
    (TABLE / "summary_stage2_sim.json").write_text(json.dumps({
        "capacity_main": CAP_MAIN, "seeds": SEEDS, "days_per_seed": DAYS_PER_SEED,
        "villages": villages.to_dict(orient="records")}, ensure_ascii=False, indent=2, default=float), encoding="utf-8")
    pd.set_option("display.width", 250)
    print(villages.to_string())
    cols = ["cap", "scenario", "fuel", "rule", "carfac", "수송률", "변화율", "변화율_시드최소", "변화율_시드최대",
            "일별변화_p5", "일별변화_p95", "배출증가일_비율", "출발편수_일평균", "출발한_날_비율", "차량km_일", "차량시간_일",
            "필요차량_p95", "차량1대당_시간", "최대대기_분"]
    print(detail[cols].round(2).to_string())


def ef_uncertainty(draws=300):
    """배출계수를 범위 안에서 300번 뽑아 대표 조건(예약자 1%, 참여율 30%, 6석)의 변화율 분포를 본다.
    수요는 시드 11의 100일로 고정하고 배출계수만 바꾼다 (배차 판단도 뽑힌 계수로 다시 한다)."""
    rng = np.random.default_rng(7)
    drng = np.random.default_rng(11 * 1000 + 100 + 30)
    days = []
    for _ in range(DAYS_PER_SEED):
        people = make_day(drng, 0.01, 0.3)
        days.append((people, bundle(people, CAP_MAIN)))
    rows = []
    for k in range(draws):
        car = rng.uniform(*EF_RANGE["car"])
        vans = {"경유": rng.uniform(*EF_RANGE["van"]), "전기": rng.uniform(*EF_RANGE["ev"])}
        for scen in ("보수", "기본"):
            for fuel in ("경유", "전기"):
                for rule in ("A", "B"):
                    r = [evaluate(p, b, SCENARIOS[scen], rule, vans[fuel], 1.0, car) for p, b in days]
                    base, tot = sum(x["base"] for x in r), sum(x["total"] for x in r)
                    rows.append(dict(draw=k, scenario=scen, fuel=fuel, rule=rule, change=100 * (tot - base) / base))
    d = pd.DataFrame(rows)
    out = d.groupby(["scenario", "fuel", "rule"])["change"].agg(
        p5=lambda s: np.percentile(s, 5), 중앙값="median", p95=lambda s: np.percentile(s, 95),
        감축확률=lambda s: float((s < -0.5).mean())).reset_index()
    print(out.round(2).to_string())
    return out


def figure(grid):
    panels = [("보수", "경유", "A", "① 보수 21.3%·경유·4명 이상 출발"),
              ("기본", "경유", "B", "② 기본 40%·경유·손익분기 기준"),
              ("보수", "전기", "B", "③ 보수 21.3%·전기·손익분기 기준"),
              ("기본", "전기", "B", "④ 기본 40%·전기·손익분기 기준")]
    norm = TwoSlopeNorm(vmin=-80, vcenter=0, vmax=160)
    fig, axes = plt.subplots(1, 4, figsize=(17, 4.3), sharey=True)
    for ax, (scen, fuel, rule, title) in zip(axes, panels):
        sub = grid[(grid.scenario == scen) & (grid.fuel == fuel) & (grid.rule == rule)].pivot(
            index="part", columns="rate", values="변화율")
        im = ax.imshow(sub.values, cmap="RdYlGn_r", norm=norm, origin="lower", aspect="auto")
        for i in range(sub.shape[0]):
            for j in range(sub.shape[1]):
                v = sub.values[i, j]
                ax.text(j, i, "0%" if abs(v) < 0.5 else f"{v:+.0f}%", ha="center", va="center", fontsize=9,
                        color="white" if (v > 70 or v < -45) else COLORS["ink"])
        ax.set_xticks(range(len(RATES)), [f"{r * 100:g}%" for r in RATES])
        ax.set_yticks(range(len(PARTS)), [f"{p:.0%}" for p in PARTS])
        ax.set_xlabel("평일 하루 종합병원 예약자 비율 (가정)", fontsize=8.5)
        ax.set_title(title, fontsize=9.5)
    axes[0].set_ylabel("예약 연계 참여율 (가정)")
    fig.colorbar(im, ax=axes, label="기준 대비 탄소 배출 변화율", shrink=0.9)
    fig.suptitle("연천군 가상 수요 시뮬레이션: 조건별 탄소 배출 변화율 (정원 6석, 5개 시드 × 100일, 음수 = 감축)", fontsize=11)
    fig.text(0.01, -0.04, "자료: SGIS 2024 인구, 심평원 2026.6 병원 위치로 만든 가상 수요. 배출계수·전환율·예약자 비율·참여율은 가정. "
             "기준 = 참여자 중 전환율만큼의 승용차 왕복 배출.", fontsize=8, color=COLORS["muted"])
    fig.savefig(FIG / "fig6_yeoncheon_heatmap.png")
    plt.close(fig)


if __name__ == "__main__":
    main()
