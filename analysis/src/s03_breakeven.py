"""2단계-①: 취약지역별 탄소 손익분기 최소 합승 인원 (정책 시뮬레이션, 분석 3)

기획안 5장 계산식에 차량 전환율을 반영한다.
  승용차 대체 배출 = 인원 × 전환율 × 병원 왕복거리 × 승용차 배출계수
  공동배차 배출   = (마을 경유 거리 + 병원 왕복거리) × 우회계수 × 승합 배출계수
  최소 합승 인원   = 공동배차 배출 < 승용차 대체 배출 이 되는 가장 작은 정수

거리: 읍면동 대표점에서 가장 가까운 종합병원급까지 (도로 보정 직선거리, 실데이터).
마을 경유 거리: 읍면동 면적의 제곱근(km)으로 근사 — 면 안의 마을을 도는 거리의 규모 (가정).
"""
import json

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from config import ASSUMPTIONS as A, COLORS, FIG, PROCESSED, SCENARIOS, TABLE


def n_star(one_way_km, village_km, conv, detour=A["detour_factor"], car=A["car_kg_per_km"], van=A["van_kg_per_km"]):
    drt = (village_km + 2 * one_way_km) * detour * van
    per = conv * 2 * one_way_km * car
    return np.floor(drt / per) + 1


def main():
    d = pd.read_csv(PROCESSED / "gg_dong_scored.csv")
    d["village_km"] = np.sqrt(d["area_km2"])
    for name, conv in SCENARIOS.items():
        d[f"nstar_{name}"] = n_star(d["dist_general_km"], d["village_km"], conv).astype(int)
    cap = A["van_capacity"]
    v = d[d["vulnerable"]].copy()

    bands = [0, 5, 10, 15, 20, 30, 60]
    labels = ["5km 미만", "5~10km", "10~15km", "15~20km", "20~30km", "30km 이상"]
    v["band"] = pd.cut(v["dist_general_km"], bands, labels=labels, right=False)
    rule = v.groupby("band", observed=False).agg(
        취약지역수=("ADM_CD", "size"), 고령인구=("pop65", "sum"),
        **{f"최소합승_{k}(중앙값)": (f"nstar_{k}", "median") for k in SCENARIOS})
    rule.to_csv(TABLE / "t5_rule_by_distance.csv", encoding="utf-8-sig")

    # 이론 곡선 (마을 경유 거리는 취약지역 중앙값)
    vk = float(v["village_km"].median())
    km = np.arange(3, 45, 0.5)
    curve = pd.DataFrame({"km": km, **{k: n_star(km, vk, c) for k, c in SCENARIOS.items()}})
    curve.to_csv(TABLE / "t6_curve.csv", index=False, encoding="utf-8-sig")

    # 도로보정 계수 민감도 (15km 직선 → 도로)
    sens = []
    for rf in (1.2, 1.3, 1.5):
        one = 15 / 1.3 * rf
        sens.append({"도로보정": rf, **{k: int(n_star(one, vk, c)) for k, c in SCENARIOS.items()}})
    pd.DataFrame(sens).to_csv(TABLE / "t7_roadfactor_sensitivity.csv", index=False, encoding="utf-8-sig")

    for k, conv in SCENARIOS.items():
        v[f"nstar_ev_{k}"] = n_star(v["dist_general_km"], v["village_km"], conv, van=A["ev_van_kg_per_km"]).astype(int)
    feasible = {k: int((v[f"nstar_{k}"] <= cap).sum()) for k in SCENARIOS}
    summary = {
        "village_km_median": round(vk, 1),
        "vulnerable_dist_general_median": round(float(v["dist_general_km"].median()), 1),
        "feasible_within_capacity": feasible, "n_vulnerable": int(len(v)),
        "nstar_median": {k: float(v[f"nstar_{k}"].median()) for k in SCENARIOS},
        "at_15km": {k: int(n_star(15, vk, c)) for k, c in SCENARIOS.items()},
        "at_30km": {k: int(n_star(30, vk, c)) for k, c in SCENARIOS.items()},
        "ev_nstar_median": {k: float(v[f"nstar_ev_{k}"].median()) for k in SCENARIOS},
        "ev_at_15km": {k: int(n_star(15, vk, c, van=A["ev_van_kg_per_km"])) for k, c in SCENARIOS.items()},
        "asymptote_diesel": {k: round(A["detour_factor"] * A["van_kg_per_km"] / (c * A["car_kg_per_km"]), 2) for k, c in SCENARIOS.items()},
    }
    (TABLE / "summary_stage2_breakeven.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    d.to_csv(PROCESSED / "gg_dong_breakeven.csv", index=False, encoding="utf-8-sig")

    # 그림 5
    fig, ax = plt.subplots(figsize=(7.5, 4.8))
    styles = {"보수": (COLORS["clay"], "-"), "기본": (COLORS["forest"], "--"), "적극": (COLORS["leaf"], ":")}
    for k, (col, ls) in styles.items():
        ax.step(curve.km, curve[k], where="post", color=col, ls=ls, lw=2.2, label=f"{k} (전환율 {SCENARIOS[k]:.1%})")
    for c_, lab in ((cap, f"승객 {cap}석 (7인승, 시뮬레이션 기준)"), (A["van_capacity_alt"], f"승객 {A['van_capacity_alt']}석 (비교)")):
        ax.axhline(c_, color=COLORS["muted"], lw=1, ls="-" if c_ == cap else "--")
        ax.text(44, c_ + 0.4, lab, ha="right", fontsize=8, color=COLORS["muted"])
    ax.scatter(v["dist_general_km"], np.full(len(v), 0.6), marker="|", s=90, color=COLORS["ink"], alpha=0.5,
               label="취약지역 읍면동의 종합병원 거리")
    ax.set_ylim(0, 30), ax.set_xlim(3, 45)
    ax.set_xlabel("가장 가까운 종합병원까지 거리 (km)")
    ax.set_ylabel("최소 합승 인원 (명)")
    ax.set_title("병원 거리와 차량 전환율에 따른 최소 합승 인원", fontsize=12)
    ax.legend(fontsize=8, loc="upper right")
    ax.spines[["top", "right"]].set_visible(False)
    fig.text(0.01, -0.03, "정책 시뮬레이션. 거리 = 실데이터 직선거리 × 1.3, 마을 경유 거리 = 취약지역 면적 제곱근 중앙값. 배출계수·기본/적극 전환율은 가정.",
             fontsize=7, color=COLORS["muted"])
    fig.savefig(FIG / "fig5_breakeven_curve.png")
    plt.close(fig)

    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print(rule.to_string())
    print(pd.DataFrame(sens).to_string())


if __name__ == "__main__":
    main()
