"""1단계-③: 머신러닝 유형화의 검증과 설명 (실증 분석, 분석 2 보강)

1. 방법 비교: K-평균(기준) · 가우시안 혼합 · 계층 군집(Ward)을 같은 4개 표준화 지표로 돌려 결과 일치도(ARI)를 본다.
2. 안정성: 600곳에서 복원추출한 표본으로 K-평균을 200번 다시 학습해 전체 600곳을 배정하고,
   기준 결과와의 ARI, 유형별 자카드 안정성, 읍면동별 '고령 고립형' 소속 확률을 계산한다.
3. 설명가능 AI: 유형 이름을 정답으로 랜덤포레스트 대리모델을 학습(5겹 교차검증)하고, 순열 중요도로
   어떤 지표가 유형 구분을 좌우하는지 본다.
4. 가중치 검증: 주성분분석(PCA) 제1주성분의 적재값으로 지표 가중치를 데이터에서 추정해, 동일 가중 취약도와 순위를 비교한다.
"""
import json

import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.optimize import linear_sum_assignment
from scipy.stats import spearmanr
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.mixture import GaussianMixture
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler

from config import COLORS, FIG, PROCESSED, TABLE

FEATURES = ["고령비율", "병원급 거리(로그)", "종합병원 거리(로그)", "정류장 밀도(로그)"]
ORDER = ["고령 고립형", "병원 원거리형", "도시 외곽형", "상대적 양호"]
B = 200
SEED = 42


def features(g):
    X = np.c_[g["elderly_ratio"], np.log1p(g["dist_hosp_km"]), np.log1p(g["dist_general_km"]), np.log1p(g["stop_density"])]
    return StandardScaler().fit_transform(X)


def align(labels, ref, k=4):
    """새 군집 번호를 기준 군집 번호에 최대로 겹치게 맞춘다 (헝가리안 방법)."""
    cm = np.zeros((k, k))
    for a, b in zip(labels, ref):
        cm[a, b] += 1
    r, c = linear_sum_assignment(-cm)
    m = dict(zip(r, c))
    return np.array([m[x] for x in labels])


def main():
    g = gpd.read_file(PROCESSED / "gg_dong_scored.gpkg")
    Xs = features(g)
    base = KMeans(4, n_init=50, random_state=SEED).fit(Xs)
    ref = base.labels_
    name_of = g.groupby(ref)["cluster"].agg(lambda s: s.mode()[0]).to_dict()  # 번호 → 유형 이름 (s02 와 같은 설정)

    # 1. 방법 비교
    gmm = GaussianMixture(4, n_init=10, random_state=SEED).fit(Xs)
    alt = {
        "가우시안 혼합": gmm.predict(Xs),
        "계층 군집(Ward)": AgglomerativeClustering(4, linkage="ward").fit_predict(Xs),
    }
    rows = [{"방법": "K-평균 (기준)", "기준과 일치도(ARI)": 1.0, "실루엣": silhouette_score(Xs, ref),
             "고령 고립형 일치율": 1.0}]
    old_ref = np.array([ORDER.index(name_of[x]) for x in ref])
    for nm, lab in alt.items():
        al = align(lab, ref)
        iso = ref == [k for k, v in name_of.items() if v == "고령 고립형"][0]
        rows.append({"방법": nm, "기준과 일치도(ARI)": adjusted_rand_score(ref, lab), "실루엣": silhouette_score(Xs, lab),
                     "고령 고립형 일치율": float((al[iso] == ref[iso]).mean())})
    methods = pd.DataFrame(rows)
    methods.round(3).to_csv(TABLE / "t13_cluster_methods.csv", index=False, encoding="utf-8-sig")

    # 2. 부트스트랩 안정성
    rng = np.random.default_rng(SEED)
    n = len(g)
    aris, member = [], np.zeros((n, 4))
    jac = {k: [] for k in range(4)}
    for b in range(B):
        idx = rng.integers(0, n, n)
        km = KMeans(4, n_init=10, random_state=b).fit(Xs[idx])
        lab = align(km.predict(Xs), ref)
        aris.append(adjusted_rand_score(ref, lab))
        member[np.arange(n), lab] += 1
        for k in range(4):
            A, Bset = set(np.where(ref == k)[0]), set(np.where(lab == k)[0])
            jac[k].append(len(A & Bset) / len(A | Bset) if A | Bset else 1.0)
    member /= B
    stab = pd.DataFrame([{"유형": name_of[k], "읍면동 수": int((ref == k).sum()),
                          "자카드 안정성(평균)": np.mean(jac[k]), "자카드 안정성(5%)": np.percentile(jac[k], 5)} for k in range(4)])
    stab["유형"] = pd.Categorical(stab["유형"], ORDER)
    stab = stab.sort_values("유형")
    stab.round(3).to_csv(TABLE / "t14_bootstrap_stability.csv", index=False, encoding="utf-8-sig")
    iso_k = [k for k, v in name_of.items() if v == "고령 고립형"][0]
    g["p_isolated"] = member[:, iso_k]
    g["p_assigned"] = member[np.arange(n), ref]  # 기준 유형에 다시 배정될 확률

    # 3. 설명가능 AI: 대리모델 + 순열 중요도
    y = np.array([name_of[k] for k in ref])
    rf = RandomForestClassifier(500, random_state=SEED, min_samples_leaf=3)
    cv = cross_val_score(rf, Xs, y, cv=StratifiedKFold(5, shuffle=True, random_state=SEED))
    rf.fit(Xs, y)
    pi = permutation_importance(rf, Xs, y, n_repeats=30, random_state=SEED)
    imp = pd.DataFrame({"지표": FEATURES, "순열 중요도(정확도 감소)": pi.importances_mean, "표준편차": pi.importances_std})
    imp = imp.sort_values("순열 중요도(정확도 감소)", ascending=False)
    # 고령 고립형 대 나머지에서의 중요도
    y_iso = (y == "고령 고립형").astype(int)
    rf2 = RandomForestClassifier(500, random_state=SEED, min_samples_leaf=3).fit(Xs, y_iso)
    pi2 = permutation_importance(rf2, Xs, y_iso, n_repeats=30, random_state=SEED)
    imp["고령 고립형 구분 중요도"] = pd.Series(pi2.importances_mean, index=range(4)).reindex(imp.index).values
    imp.round(4).to_csv(TABLE / "t15_feature_importance.csv", index=False, encoding="utf-8-sig")

    # 4. PCA 가중치
    raw = np.c_[g["f_aging"], g["f_access"], g["f_supply"]]
    pca = PCA(1).fit(raw)
    w = np.abs(pca.components_[0]); w = w / w.sum()
    pca_score = 100 * raw @ w
    top = lambda s: set(np.argsort(-s)[: int(n * 0.2)])
    pca_res = {"PCA 가중치(고령·병원접근·공급부족)": [round(float(x), 3) for x in w],
               "제1주성분 설명비율": round(float(pca.explained_variance_ratio_[0]), 3),
               "동일가중과 순위상관": round(float(spearmanr(g["score"], pca_score)[0]), 3),
               "상위20% 겹침(자카드)": round(len(top(g["score"].values) & top(pca_score)) / len(top(g["score"].values) | top(pca_score)), 3)}

    g[["ADM_CD", "SI_NM", "ADM_NM", "cluster", "p_isolated", "p_assigned"]].round(3).to_csv(
        TABLE / "t16_isolated_probability.csv", index=False, encoding="utf-8-sig")
    summary = {"bootstrap_B": B, "ari_mean": round(float(np.mean(aris)), 3), "ari_p5": round(float(np.percentile(aris, 5)), 3),
               "rf_cv_accuracy_mean": round(float(cv.mean()), 3), "rf_cv_accuracy_sd": round(float(cv.std()), 3),
               "isolated_core_p90": int((g["p_isolated"] >= 0.9).sum()),
               "isolated_assigned": int((g["cluster"] == "고령 고립형").sum()),
               "yeoncheon_p_isolated": g.loc[g["SI_NM"] == "연천군", ["ADM_NM", "p_isolated"]].round(2).values.tolist(),
               "pca": pca_res}
    (TABLE / "summary_ml_validation.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    figure(g, stab, imp)
    pd.set_option("display.width", 200)
    print(methods.round(3).to_string()); print(stab.round(3).to_string()); print(imp.round(4).to_string())
    print(json.dumps(summary, ensure_ascii=False, indent=1))


def figure(g, stab, imp):
    fig = plt.figure(figsize=(14, 4.6))
    ax1 = fig.add_axes([0.0, 0.05, 0.33, 0.85])
    outline = g.dissolve("SI_NM")
    g.plot(column="p_isolated", cmap="Oranges", vmin=0, vmax=1, ax=ax1, linewidth=0.1, edgecolor="white",
           legend=True, legend_kwds={"shrink": 0.6, "label": "고령 고립형 소속 확률"})
    outline.boundary.plot(ax=ax1, color=COLORS["ink"], linewidth=0.4)
    ax1.set_axis_off()
    ax1.set_title("① 부트스트랩 200회: 고령 고립형 소속 확률", fontsize=10)

    ax2 = fig.add_axes([0.43, 0.15, 0.2, 0.7])
    ax2.barh(stab["유형"].astype(str)[::-1], stab["자카드 안정성(평균)"][::-1], color=COLORS["forest"])
    for i, (m, p5) in enumerate(zip(stab["자카드 안정성(평균)"][::-1], stab["자카드 안정성(5%)"][::-1])):
        ax2.text(m + 0.02, i, f"{m:.2f}\n({p5:.2f})", va="center", fontsize=8)
    ax2.set_xlim(0, 1.2)
    ax2.set_xlabel("자카드 안정성 평균 (괄호: 하위 5%)")
    ax2.set_title("② 유형별 안정성", fontsize=10)
    ax2.spines[["top", "right"]].set_visible(False)

    ax3 = fig.add_axes([0.81, 0.15, 0.18, 0.7])
    ax3.barh(imp["지표"][::-1], imp["순열 중요도(정확도 감소)"][::-1], color=COLORS["clay"])
    ax3.set_xlabel("섞었을 때 정확도 감소")
    ax3.set_title("③ 유형 구분을 좌우하는 지표\n(랜덤포레스트 순열 중요도)", fontsize=10)
    ax3.spines[["top", "right"]].set_visible(False)
    fig.text(0.0, -0.04, "자료: 그림 1·2와 같은 실데이터. K-평균(k=4) 기준 결과를 복원추출 표본으로 200번 다시 학습해 검증하고, "
             "랜덤포레스트 대리모델(5겹 교차검증)과 순열 중요도로 설명했다.", fontsize=7.5, color=COLORS["muted"])
    fig.savefig(FIG / "fig7_ml_validation.png")
    plt.close(fig)


if __name__ == "__main__":
    main()
