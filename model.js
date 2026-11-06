/* Match probability model: Poisson goals with the Dixon–Coles low-score correction.
   Pure functions only, so they can be tested without a browser. */
(function (root) {
  "use strict";
  var RHO = -0.08, MAXG = 10, MATCH_MIN = 96; // 90 minutes plus typical stoppage time

  function pois(k, l) { var p = Math.exp(-l); for (var i = 1; i <= k; i++) p *= l / i; return p; }

  // American moneyline to implied probability (still includes the bookmaker's margin).
  function moneylineToProb(ml) {
    ml = Number(ml);
    if (!isFinite(ml) || ml === 0) return null;
    return ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
  }

  // Remove the margin by scaling the three implied probabilities to sum to 1.
  function fairProbs(mlHome, mlDraw, mlAway) {
    var h = moneylineToProb(mlHome), d = moneylineToProb(mlDraw), a = moneylineToProb(mlAway);
    if (h == null || d == null || a == null) return null;
    var s = h + d + a;
    return { H: h / s, D: d / s, A: a / s, margin: s - 1 };
  }

  // Distribution of goals still to come, with the low-score correction.
  function remainingMatrix(lh, la) {
    var M = [], tot = 0, i, j;
    for (i = 0; i <= MAXG; i++) {
      M.push([]);
      for (j = 0; j <= MAXG; j++) {
        var tau = 1;
        if (i === 0 && j === 0) tau = 1 - lh * la * RHO;
        else if (i === 0 && j === 1) tau = 1 + lh * RHO;
        else if (i === 1 && j === 0) tau = 1 + la * RHO;
        else if (i === 1 && j === 1) tau = 1 - RHO;
        var p = pois(i, lh) * pois(j, la) * Math.max(tau, 0);
        M[i].push(p); tot += p;
      }
    }
    for (i = 0; i <= MAXG; i++) for (j = 0; j <= MAXG; j++) M[i][j] /= tot;
    return M;
  }

  // Outcome probabilities for the final score, given the score now and the goal rates still to come.
  function outcome(lhRem, laRem, curH, curA) {
    curH = curH || 0; curA = curA || 0;
    var R = remainingMatrix(lhRem, laRem);
    var out = { H: 0, D: 0, A: 0, over25: 0, btts: 0, csHome: 0, csAway: 0, best: [curH, curA], bestP: 0, final: {} };
    for (var i = 0; i <= MAXG; i++) for (var j = 0; j <= MAXG; j++) {
      var q = R[i][j], fh = curH + i, fa = curA + j;
      if (fh > fa) out.H += q; else if (fh === fa) out.D += q; else out.A += q;
      if (fh + fa > 2) out.over25 += q;
      if (fh > 0 && fa > 0) out.btts += q;
      if (fa === 0) out.csHome += q;
      if (fh === 0) out.csAway += q;
      out.final[fh + "-" + fa] = (out.final[fh + "-" + fa] || 0) + q;
      if (q > out.bestP) { out.bestP = q; out.best = [fh, fa]; }
    }
    return out;
  }

  // Find full-match goal rates whose home/away win chances match the market's.
  function fitLambdas(pH, pA) {
    var best = null, step, lh, la, o, err;
    function scan(h0, h1, a0, a1, st) {
      for (lh = h0; lh <= h1 + 1e-9; lh += st) for (la = a0; la <= a1 + 1e-9; la += st) {
        o = outcome(lh, la, 0, 0);
        err = (o.H - pH) * (o.H - pH) + (o.A - pA) * (o.A - pA);
        if (!best || err < best.err) best = { lh: lh, la: la, err: err };
      }
    }
    scan(0.1, 5, 0.1, 5, 0.2);
    for (step = 0.04; step >= 0.005; step /= 4) {
      var c = best;
      scan(Math.max(0.05, c.lh - step * 5), c.lh + step * 5, Math.max(0.05, c.la - step * 5), c.la + step * 5, step);
    }
    return { lh: best.lh, la: best.la };
  }

  // Goal rates from season goals for/against per game. rows: [{id, gp, gf, ga}]
  function formLambdas(rows, homeId, awayId, neutral) {
    var played = rows.filter(function (r) { return r.gp > 0; });
    if (!played.length) return null;
    var h = rows.find(function (r) { return r.id === homeId; }), a = rows.find(function (r) { return r.id === awayId; });
    if (!h || !a) return null;
    var tg = 0, tp = 0;
    played.forEach(function (r) { tg += r.gf; tp += r.gp; });
    var avg = tg / tp || 1.3, K = 3;
    function rate(r, key) { if (!r.gp) return 1; var raw = (r[key] / r.gp) / avg, w = r.gp / (r.gp + K); return 1 + (raw - 1) * w; }
    var homeAdv = neutral ? 1 : 1.12, awayAdv = neutral ? 1 : 0.9;
    return { lh: avg * rate(h, "gf") * rate(a, "ga") * homeAdv, la: avg * rate(a, "gf") * rate(h, "ga") * awayAdv };
  }

  // Share of a full match's goal rate still to come at a given elapsed minute.
  function remainingShare(minute) { return Math.max(0, MATCH_MIN - Math.min(minute, MATCH_MIN)) / MATCH_MIN; }

  // Goal rates still to come, cut for red cards: 25% down for the side short of players, 15% up for the other.
  function liveRates(lh, la, minute, redsH, redsA) {
    var s = remainingShare(minute);
    var fh = Math.pow(0.75, redsH || 0) * Math.pow(1.15, redsA || 0);
    var fa = Math.pow(0.75, redsA || 0) * Math.pow(1.15, redsH || 0);
    return { lh: lh * s * fh, la: la * s * fa };
  }

  // Win probability at each minute, replaying goals and red cards.
  // events: [{min, type:"goal"|"red", side:"h"|"a", h?, a?}] with h/a the score after a goal.
  function flow(lh, la, events, uptoMinute) {
    var pts = [], gh = 0, ga = 0, rh = 0, ra = 0, k = 0;
    var evs = events.slice().sort(function (x, y) { return x.min - y.min; });
    var end = Math.max(0, Math.min(uptoMinute, MATCH_MIN));
    for (var m = 0; m <= end; m++) {
      while (k < evs.length && evs[k].min <= m) {
        var e = evs[k++];
        if (e.type === "goal") { if (e.h != null) { gh = e.h; ga = e.a; } else if (e.side === "h") gh++; else ga++; }
        else if (e.type === "red") { if (e.side === "h") rh++; else ra++; }
      }
      var r = liveRates(lh, la, m, rh, ra), o = outcome(r.lh, r.la, gh, ga);
      pts.push({ min: m, H: o.H, D: o.D, A: o.A, gh: gh, ga: ga });
    }
    return pts;
  }

  var api = { moneylineToProb: moneylineToProb, fairProbs: fairProbs, outcome: outcome, fitLambdas: fitLambdas,
    formLambdas: formLambdas, remainingShare: remainingShare, liveRates: liveRates, flow: flow, MATCH_MIN: MATCH_MIN };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Model = api;
})(this);
