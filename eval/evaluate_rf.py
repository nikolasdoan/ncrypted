"""Per-user swipe classifier on Touchalytics, tested on impostors it never saw.

For each owner U on phone P, the other people on P are split into two halves:
one half (plus everyone on other phones) are training negatives, the other half
are the test impostors - then the halves swap. A test impostor never contributes
a single swipe to training, so the result is what happens when a stranger picks
up the owner's phone.

Scenarios
  same-day : train on the first 60% of each session's swipes, test on the rest
  later    : train on sessions 1-5, test on sessions 6-7 (recorded 7-14 days later)
"""
import csv, math, random, sys, json
from collections import defaultdict
import numpy as np
from sklearn.ensemble import RandomForestClassifier

random.seed(7); np.random.seed(7)
path, out = sys.argv[1], sys.argv[2]

rows = defaultdict(list)
with open(path) as f:
    for r in csv.reader(f):
        rows[(int(r[0]), int(r[1]), int(r[2]))].append(
            (int(r[3]), int(r[4]), float(r[6]), float(r[7]), float(r[8]), float(r[9])))


def feats(s):
    t = np.array([p[0] for p in s], float); x = np.array([p[1] for p in s]); y = np.array([p[2] for p in s])
    pr = np.array([p[3] for p in s]); ar = np.array([p[4] for p in s])
    dt = np.diff(t) / 1000; dx = np.diff(x); dy = np.diff(y); step = np.hypot(dx, dy)
    ok = dt > 0; v = step[ok] / dt[ok] if ok.any() else np.array([0.0])
    L = step.sum(); D = math.hypot(x[-1]-x[0], y[-1]-y[0]); dur = max(t[-1]-t[0], 1)
    # largest deviation from the straight line start->end
    if D > 0:
        dev = np.abs((x[-1]-x[0])*(y[0]-y) - (x[0]-x)*(y[-1]-y[0])) / D
    else:
        dev = np.array([0.0])
    mid = len(s) // 2
    return [x[0], y[0], x[-1], y[-1], math.log(dur), math.log(L+1), D/L if L else 1,
            math.atan2(y[-1]-y[0], x[-1]-x[0]), *np.percentile(v, [20, 50, 80]),
            float(np.mean(v[:3])), float(np.mean(v[-3:])), float(dev.max()), float(dev.mean()),
            pr[mid], pr.mean(), ar[mid], ar.mean(), len(s)]


# strokes per (phone, user): list of (doc, order, featurevector)
S = defaultdict(list)
for (ph, u, doc), evs in rows.items():
    evs.sort(key=lambda e: e[0]); cur = None; n = 0
    for t, a, x, y, p, ar in evs:
        if a == 0: cur = [(t, x, y, p, ar)]
        elif cur is not None:
            cur.append((t, x, y, p, ar))
            if a == 1:
                xs = [c[1] for c in cur]; ys = [c[2] for c in cur]
                if len(cur) >= 4 and max(xs)-min(xs)+max(ys)-min(ys) > 20:
                    S[(ph, u)].append((doc, n, feats(cur))); n += 1
                cur = None


def split(strokes, scenario):
    if scenario == "later":
        return [f for d, n, f in strokes if d <= 5], [f for d, n, f in strokes if d >= 6]
    tr, te = [], []
    by_doc = defaultdict(list)
    for d, n, f in strokes: by_doc[d].append((n, f))
    for d, lst in by_doc.items():
        lst.sort(key=lambda z: z[0]); cut = int(len(lst) * 0.6)
        tr += [f for _, f in lst[:cut]]; te += [f for _, f in lst[cut:]]
    return tr, te


def windows(pool, k, m):
    if len(pool) < k: return []
    return [pool[i:i+k] for i in (random.randrange(0, len(pool)-k+1) for _ in range(m))]


def evaluate(scenario, ks):
    data = {key: split(v, scenario) for key, v in S.items()}
    gen = {k: [] for k in ks}; imp = {k: [] for k in ks}; owners = set()
    for (ph, u), (tr, te) in data.items():
        if len(tr) < 30 or len(te) < max(ks): continue
        same = [key for key in data if key[0] == ph and key != (ph, u)]
        if len(same) < 2: continue
        random.shuffle(same); halves = [same[: len(same)//2], same[len(same)//2:]]
        owners.add((ph, u))
        for h in (0, 1):
            known, unseen = halves[h], halves[1-h]
            neg = [f for key in data if key != (ph, u) and key not in unseen for f in data[key][0]]
            neg = random.sample(neg, min(len(neg), 6 * len(tr)))
            X = np.array(tr + neg); yv = np.array([1]*len(tr) + [0]*len(neg))
            clf = RandomForestClassifier(n_estimators=200, min_samples_leaf=2, class_weight="balanced",
                                         n_jobs=-1, random_state=0).fit(X, yv)
            p_own = clf.predict_proba(np.array(te))[:, 1]
            for k in ks:
                for w in windows(list(p_own), k, 20): gen[k].append(float(np.mean(w)))
            for key in unseen:
                pool = data[key][1]
                if len(pool) < max(ks): continue
                p_imp = clf.predict_proba(np.array(pool))[:, 1]
                for k in ks:
                    for w in windows(list(p_imp), k, 20): imp[k].append(float(np.mean(w)))
    res = []
    for k in ks:
        g = np.array(gen[k]); i = np.array(imp[k])
        ths = np.unique(np.concatenate([g, i]))
        frr = np.array([(g < t).mean() for t in ths]); far = np.array([(i >= t).mean() for t in ths])
        j = np.argmin(np.abs(frr - far))
        # owner pass-rate when only 1 in 20 impostors gets through
        ok = far <= 0.05; tar5 = float((1 - frr[ok]).max()) if ok.any() else 0.0
        res.append({"scenario": scenario, "owners": len(owners), "swipes": k,
                    "EER": round(float((frr[j]+far[j])/2)*100, 1),
                    "owner_pass_at_5pct_impostor": round(tar5*100, 1),
                    "n_gen": len(g), "n_imp": len(i),
                    "roc": [[round(float(a), 4), round(float(1-b), 4)] for a, b in zip(far[::max(1, len(ths)//200)], frr[::max(1, len(ths)//200)])]})
    return res


allres = evaluate("same-day", [1, 5, 10, 20]) + evaluate("later", [1, 5, 10, 20])
for r in allres:
    print({k: v for k, v in r.items() if k != "roc"})
json.dump(allres, open(out, "w"))
