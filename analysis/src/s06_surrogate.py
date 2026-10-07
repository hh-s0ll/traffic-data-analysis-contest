"""2단계-④: AI 대리모델(메타모델)로 운영 성과 민감도 분석과 시군별 운영 추천 (정책 시뮬레이션)

s05 시나리오 데이터(15개 시군 × 200개 조건)로, 지역 특성과 운영조건 → 운영 성과를 예측하는 모델을 학습한다.
- 모델: XGBoost, 랜덤포레스트, 평균값 기준모델
- 검증: 시군 단위 GroupKFold(5겹). 검증 시군의 시나리오는 학습에 쓰지 않는다. 표본 밖 예측의 MAE·R²를 보고한다.
- 설명: 성능이 좋은 모델에 SHAP(TreeExplainer)을 적용해 탄소 변화율·수송률을 좌우하는 요인을 본다.
- 추천: 대표 수요 가정에서 시군·차량 조건별 성과를 대리모델로 예측해 운영 방식을 고르고,
        같은 조건을 시뮬레이션으로 직접 계산해 대리모델 판단과의 일치율을 확인한다.
주의: 대리모델은 시뮬레이션을 흉내 내는 모델이다. 예측 정확도는 '시뮬레이션 재현 정확도'이며 현실 정확도가 아니다.
"""
import json

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupKFold
from xgboost import XGBRegressor

from config import ASSUMPTIONS as A, COLORS, FIG, TABLE

REGION = ["읍면수", "고령인구", "고령고립형비율", "평균고령비율", "평균종합병원거리km", "평균정류장밀도", "평균차고지거리km"]
COND = ["rate", "part", "morning", "conv", "carfac", "전기", "cap", "wait", "규칙B", "car_ef", "van_ef", "예상참여자"]
LABEL = {"rate": "예약자 비율", "part": "참여율", "morning": "오전 진료 집중도", "conv": "차량 전환율", "carfac": "승용차 운행 계수",
         "전기": "전기 승합", "cap": "좌석 수", "wait": "허용 대기", "규칙B": "손익분기 규칙", "car_ef": "승용차 배출계수",
         "van_ef": "승합 배출계수", "예상참여자": "하루 예상 참여자", "읍면수": "읍면 수", "고령인구": "고령인구",
         "고령고립형비율": "고령 고립형 비율", "평균고령비율": "고령비율", "평균종합병원거리km": "종합병원 거리",
         "평균정류장밀도": "정류장 밀도", "평균차고지거리km": "차고지 거리"}
TARGETS = {"탄소변화율": "탄소 변화율(%)", "수송률": "수송률", "필요차량": "필요 차량(대)", "차량km_일": "차량km/일", "최대대기_분": "최대 대기(분)"}
SERVE_MIN = 0.5  # 운영 판단 기준: 참여자 절반 이상을 공동배차로 수송


def prepare(df):
    X = df.copy()
    X["전기"] = (X["fuel"] == "전기").astype(int)
    X["규칙B"] = (X["rule"] == "B").astype(int)
    X["예상참여자"] = X["고령인구"] * X["rate"] * X["part"]
    return X[REGION + COND]


def models():
    return {
        "XGBoost": lambda: XGBRegressor(n_estimators=600, learning_rate=0.05, max_depth=5, subsample=0.8,
                                        colsample_bytree=0.8, random_state=42, n_jobs=4),
        "랜덤포레스트": lambda: RandomForestRegressor(n_estimators=400, min_samples_leaf=2, random_state=42, n_jobs=4),
    }


def evaluate(df):
    X, groups = prepare(df), df["시군"].values
    gkf = GroupKFold(n_splits=5)
    rows, best = [], {}
    for t in TARGETS:
        y = df[t].values
        oof = {m: np.zeros(len(y)) for m in list(models()) + ["평균 기준모델"]}
        for tr, te in gkf.split(X, y, groups):
            for m, make in models().items():
                oof[m][te] = make().fit(X.iloc[tr], y[tr]).predict(X.iloc[te])
            oof["평균 기준모델"][te] = y[tr].mean()
        for m, p in oof.items():
            rows.append({"목표": TARGETS[t], "모델": m, "MAE": mean_absolute_error(y, p), "R2": r2_score(y, p)})
        r2 = {m: r2_score(y, oof[m]) for m in models()}
        best[t] = max(r2, key=r2.get)
    return pd.DataFrame(rows), best


def shap_figure(df, best):
    X = prepare(df).rename(columns=LABEL)
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.2))
    imp_rows = []
    for ax, t in zip(axes, ["탄소변화율", "수송률"]):
        model = XGBRegressor(n_estimators=600, learning_rate=0.05, max_depth=5, subsample=0.8, colsample_bytree=0.8,
                             random_state=42, n_jobs=4).fit(X, df[t])
        sv = shap.TreeExplainer(model)(X)
        plt.sca(ax)
        shap.plots.beeswarm(sv, max_display=10, show=False, ax=ax, plot_size=None, color_bar=(t == "수송률"))
        ax.set_title(f"{TARGETS[t]}에 대한 SHAP (XGBoost)", fontsize=11)
        ax.tick_params(labelsize=9)
        ax.set_xlabel("SHAP 값 (예측을 올리는 방향 +)", fontsize=9)
        mean_abs = np.abs(sv.values).mean(axis=0)
        for f, v in zip(X.columns, mean_abs):
            imp_rows.append({"목표": TARGETS[t], "요인": f, "평균 |SHAP|": v})
    # 영문 기본 표기를 한국어로
    for ax_ in fig.axes:
        labs = [t.get_text() for t in ax_.get_yticklabels()]
        if any("other features" in s for s in labs):
            ax_.set_yticks(ax_.get_yticks(), [s.replace("Sum of ", "나머지 ").replace(" other features", "개 요인 합") for s in labs])
        if ax_.get_ylabel() == "Feature value":
            ax_.set_ylabel("요인 값", fontsize=9)
            ax_.set_yticks(ax_.get_yticks(), ["작음" if t.get_text() == "Low" else "큼" if t.get_text() == "High" else t.get_text()
                                              for t in ax_.get_yticklabels()])
    n_scen = len(df) // df["시군"].nunique()
    fig.text(0.0, -0.03, f"정책 시뮬레이션 {df['시군'].nunique()}개 시군 × {n_scen}개 조건으로 학습한 대리모델의 설명. 점 색은 요인 값의 크기(빨강 = 큼). "
             "결과는 시뮬레이션 가정 안에서의 영향이다.", fontsize=8, color=COLORS["muted"])
    fig.tight_layout()
    fig.savefig(FIG / "fig8_shap.png")
    plt.close(fig)
    imp = pd.DataFrame(imp_rows).sort_values(["목표", "평균 |SHAP|"], ascending=[True, False])
    imp.round(3).to_csv(TABLE / "t19_shap_importance.csv", index=False, encoding="utf-8-sig")
    return imp


def recommend(df, best):
    """대표 수요(예약자 1%, 참여율 30%, 오전 60%, 대기 60분, 운행 계수 1.0)에서 시군·차량 조건별 판단."""
    from s05_scenarios import AREAS, run_one
    X_all = prepare(df)
    fitted = {t: models()[best[t]]().fit(X_all, df[t]) for t in ["수송률", "필요차량", "탄소변화율"]}
    options = [("경유", 6), ("전기", 6), ("경유", 11), ("전기", 11)]
    rows = []
    for si, a in AREAS.items():
        for conv in (0.213, 0.40):
            for fuel, cap in options:
                c = dict(rate=0.01, part=0.3, morning=0.6, conv=conv, carfac=1.0, fuel=fuel, cap=cap, wait=60, rule="B",
                         car_ef=A["car_kg_per_km"], van_ef=A["van_kg_per_km"] if fuel == "경유" else A["ev_van_kg_per_km"])
                row = {**a["feat"], **c}
                x = prepare(pd.DataFrame([row]))
                pred = {t: float(m.predict(x)[0]) for t, m in fitted.items()}
                sim = run_one(si, c, 777)
                rows.append({"시군": si, "전환율": conv, "차종": fuel, "좌석": cap,
                             "수송률_예측": pred["수송률"], "수송률_시뮬": sim["수송률"],
                             "필요차량_예측": pred["필요차량"], "필요차량_시뮬": sim["필요차량"],
                             "탄소_예측": pred["탄소변화율"], "탄소_시뮬": sim["탄소변화율"]})
    grid = pd.DataFrame(rows)

    def decide(sub, col):
        cur = sub[(sub["전환율"] == 0.213)]
        ok_now = cur[cur[col] >= SERVE_MIN]
        if ((ok_now["차종"] == "경유") & (ok_now["좌석"] == 6)).any():
            return "공동배차 권장", "현행(경유 6석)"
        if len(ok_now):
            r = ok_now.sort_values(col, ascending=False).iloc[0]
            return "차량 조건 조정", f"{r['차종']} {r['좌석']}석"
        hi = sub[(sub["전환율"] == 0.40) & (sub[col] >= SERVE_MIN)]
        if len(hi):
            r = hi.sort_values(col, ascending=False).iloc[0]
            return "전환율 실측 시범", f"전환율 40%면 {r['차종']} {r['좌석']}석"
        return "대체 서비스 연결", "호출형·의료동행"

    rec = []
    for si, sub in grid.groupby("시군"):
        d_pred, o_pred = decide(sub, "수송률_예측")
        d_sim, o_sim = decide(sub, "수송률_시뮬")
        feat = AREAS[si]["feat"]
        rec.append({"시군": si, "고령 고립형 비율": feat["고령고립형비율"], "평균 종합병원 거리km": feat["평균종합병원거리km"],
                    "AI 판단": d_pred, "조건": o_pred, "직접 시뮬레이션 판단": d_sim, "일치": d_pred == d_sim})
    rec = pd.DataFrame(rec).sort_values(["AI 판단", "고령 고립형 비율"], ascending=[True, False])
    return grid, rec


def main():
    df = pd.read_csv(TABLE / "t17_scenarios.csv")
    metrics, best = evaluate(df)
    metrics.round(3).to_csv(TABLE / "t18_surrogate_metrics.csv", index=False, encoding="utf-8-sig")
    imp = shap_figure(df, best)
    grid, rec = recommend(df, best)
    grid.round(3).to_csv(TABLE / "t20_recommend_grid.csv", index=False, encoding="utf-8-sig")
    # 최종 추천표: 판단은 직접 시뮬레이션 기준, 현행(경유 6석·전환율 21.3%)과 개선안(전기 11석·전환율 40%) 성과를 함께 적는다
    pick = lambda conv, fuel, cap: grid[(grid["전환율"] == conv) & (grid["차종"] == fuel) & (grid["좌석"] == cap)].set_index("시군")
    now, best_case = pick(0.213, "경유", 6), pick(0.40, "전기", 11)
    final = rec.set_index("시군")[["고령 고립형 비율", "평균 종합병원 거리km", "직접 시뮬레이션 판단", "AI 판단", "일치"]].copy()
    final["현행 수송률"] = now["수송률_시뮬"]
    final["개선안 수송률"] = best_case["수송률_시뮬"]
    final["개선안 필요차량"] = best_case["필요차량_시뮬"]
    final["개선안 탄소변화율"] = best_case["탄소_시뮬"]
    final.reset_index().round(3).to_csv(TABLE / "t22_final_recommendation.csv", index=False, encoding="utf-8-sig")
    print(final.round(2).to_string())
    rec.round(3).to_csv(TABLE / "t21_recommendation.csv", index=False, encoding="utf-8-sig")
    agree = {
        "판단 일치율": float(rec["일치"].mean()),
        "수송률 MAE(예측 vs 직접)": float((grid["수송률_예측"] - grid["수송률_시뮬"]).abs().mean()),
        "필요차량 MAE": float((grid["필요차량_예측"] - grid["필요차량_시뮬"]).abs().mean()),
    }
    (TABLE / "summary_surrogate.json").write_text(json.dumps({"best": best, **agree}, ensure_ascii=False, indent=2),
                                                  encoding="utf-8")
    pd.set_option("display.width", 220)
    print(metrics.round(3).to_string())
    print(best, agree)
    print(imp.groupby("목표").head(6).round(3).to_string())
    print(rec.round(2).to_string())


if __name__ == "__main__":
    main()
