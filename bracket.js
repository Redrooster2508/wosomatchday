/* Knockout bracket: real ties from the feed, title chances worked out through the bracket,
   or a projection from the current table when the knockouts haven't started. */
(function (root) {
  "use strict";
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pct(p) { return p >= 0.995 ? "99%+" : p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%"; }

  // Group a round's matches into ties (two legs share a pair of teams).
  function ties(matches) {
    var by = {};
    matches.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); }).forEach(function (m) {
      var k = [m.home.id, m.away.id].sort().join("|");
      (by[k] = by[k] || []).push(m);
    });
    return Object.keys(by).map(function (k) {
      var legs = by[k], first = legs[0], ids = [first.home.id, first.away.id], agg = {}, teams = {};
      ids.forEach(function (id) { agg[id] = 0; });
      legs.forEach(function (m) {
        [m.home, m.away].forEach(function (t) { teams[t.id] = t; if (m.state !== "pre") agg[t.id] += t.score; });
      });
      var last = legs[legs.length - 1], done = last.state === "post", winner = null;
      if (done) {
        var w = [last.home, last.away].find(function (t) { return t.winner; });
        if (w) winner = w.id;
        else if (agg[ids[0]] !== agg[ids[1]]) winner = agg[ids[0]] > agg[ids[1]] ? ids[0] : ids[1];
      }
      return { ids: ids, teams: teams, agg: agg, legs: legs, done: done, live: legs.some(function (m) { return m.state === "in"; }), winner: winner };
    });
  }

  // Chance that `a` beats `b` over one match; a level game is split by relative strength (extra time, penalties).
  function advance(api, a, b, homeId, neutral) {
    var o = api.matchOutcome(homeId === a ? a : b, homeId === a ? b : a, neutral);
    if (!o) return 0.5;
    var pa = homeId === a ? o.H : o.A, pb = homeId === a ? o.A : o.H;
    return pa + o.D * (pa + pb > 0 ? pa / (pa + pb) : 0.5);
  }

  function teamLine(t, tie, seed, api) {
    var row = el("div", "bk-team");
    if (tie && tie.done && tie.winner && tie.winner !== t.id) row.classList.add("out");
    if (tie && tie.winner === t.id) row.classList.add("won");
    if (t.logo) { var im = new Image(); im.src = t.logo; im.alt = ""; im.loading = "lazy"; row.appendChild(im); }
    row.appendChild(el("span", "bk-seed num", seed ? String(seed) : ""));
    row.appendChild(el("span", "bk-name", t.name));
    var sc = tie && tie.legs.some(function (m) { return m.state !== "pre"; }) ? String(tie.agg[t.id]) : "";
    row.appendChild(el("span", "bk-score num", sc));
    return row;
  }
  function tieBox(tie, api) {
    var box = el("button", "bk-tie"); box.type = "button";
    if (tie.live) box.classList.add("live");
    tie.ids.forEach(function (id) { box.appendChild(teamLine(tie.teams[id], tie, api.fixedBracket ? api.seed(id) : null, api)); });
    var first = tie.legs[0], meta = el("div", "bk-meta");
    if (tie.live) meta.textContent = "Live";
    else if (tie.done) meta.textContent = tie.legs.length > 1 ? "Aggregate" : (first.detail || "FT");
    else meta.textContent = api.fmtTime(first.date) + (tie.legs.length > 1 ? " · 2 legs" : "");
    box.appendChild(meta);
    box.addEventListener("click", function () { api.openMatch(tie.legs[tie.legs.length - 1]); });
    return box;
  }
  function placeholder(text) { var b = el("div", "bk-tie ph"); b.appendChild(el("div", "bk-team", text)); return b; }

  // NWSL-style fixed bracket: 1v8 and 4v5 meet in one semi, 2v7 and 3v6 in the other.
  function orderQuarterTies(qts, seed) {
    var pos = { 1: 0, 4: 1, 5: 1, 2: 2, 7: 2, 3: 3, 6: 3, 8: 0 };
    return qts.slice().sort(function (x, y) {
      var sx = Math.min(seed(x.ids[0]) || 99, seed(x.ids[1]) || 99), sy = Math.min(seed(y.ids[0]) || 99, seed(y.ids[1]) || 99);
      return (pos[sx] != null ? pos[sx] : sx) - (pos[sy] != null ? pos[sy] : sy);
    });
  }

  function titleChances(rounds, api) {
    // rounds[0] are 4 ordered quarter-final ties, later rounds are matched by team ids.
    if (rounds.length < 1 || rounds[0].ties.length !== 4) return null;
    function distOf(tie, home) {
      if (tie.done && tie.winner) { var d = {}; d[tie.winner] = 1; return d; }
      var a = tie.ids[0], b = tie.ids[1], h = home || tie.legs[0].home.id, p = advance(api, a, b, h, false), out = {};
      out[a] = p; out[b] = 1 - p; return out;
    }
    function findTie(round, ids) {
      if (!round) return null;
      return round.ties.find(function (t) { return t && ids.every(function (id) { return t.ids.indexOf(id) >= 0; }); }) || null;
    }
    function combine(A, B, round, neutral) {
      var out = {};
      Object.keys(A).forEach(function (x) { Object.keys(B).forEach(function (y) {
        var w = A[x] * B[y]; if (!w) return;
        var real = findTie(round, [x, y]);
        if (real && real.done && real.winner) { out[real.winner] = (out[real.winner] || 0) + w; return; }
        var home = neutral ? null : (real ? real.legs[0].home.id : ((api.seed(x) || 99) <= (api.seed(y) || 99) ? x : y));
        var p = advance(api, x, y, home || x, !home);
        out[x] = (out[x] || 0) + w * p; out[y] = (out[y] || 0) + w * (1 - p);
      }); });
      return out;
    }
    var q = rounds[0].ties.map(function (t) { return distOf(t); });
    var s1 = combine(q[0], q[1], rounds[1], false), s2 = combine(q[2], q[3], rounds[1], false);
    return combine(s1, s2, rounds[2], true);
  }

  function renderKnockout(box, phases, api) {
    var rounds = phases.map(function (ph) { return { name: ph.label.replace(/^Playoffs\s*-\s*/i, ""), ties: ties(ph.matches) }; });
    var isFixed8 = rounds.length && rounds[0].ties.length === 4 && api.fixedBracket;
    if (isFixed8) rounds[0].ties = orderQuarterTies(rounds[0].ties, api.seed);
    else {
      // tournaments: order each round so the two ties feeding a later tie sit next to each other
      for (var ri = rounds.length - 2; ri >= 0; ri--) {
        var next = rounds[ri + 1].ties, cur = rounds[ri].ties, ordered = [];
        next.forEach(function (nt) { cur.forEach(function (t) { if (ordered.indexOf(t) < 0 && t.ids.some(function (id) { return nt.ids.indexOf(id) >= 0; })) ordered.push(t); }); });
        cur.forEach(function (t) { if (ordered.indexOf(t) < 0) ordered.push(t); });
        rounds[ri].ties = ordered;
      }
    }
    var grid = el("div", "bk-grid"); grid.style.setProperty("--cols", rounds.length);
    rounds.forEach(function (r, ri) {
      var col = el("div", "bk-col"); col.appendChild(el("div", "eyebrow bk-round", r.name));
      var stack = el("div", "bk-stack");
      var expected = isFixed8 ? 4 / Math.pow(2, ri) : r.ties.length;
      if (isFixed8 && ri > 0) {
        // keep bracket order: each later tie sits between the two ties that feed it
        var prev = rounds[ri - 1].ties, ordered = [];
        for (var k = 0; k < expected; k++) {
          var feeders = [prev[2 * k], prev[2 * k + 1]];
          var names = feeders.map(function (f) { return f && f.ids ? f.ids : null; });
          var match = r.ties.find(function (t) { return names.some(function (n) { return n && t.ids.some(function (id) { return n.indexOf(id) >= 0; }); }); });
          ordered.push(match || null);
        }
        r.ties = ordered.filter(Boolean).length === r.ties.length ? ordered : r.ties.concat(new Array(Math.max(0, expected - r.ties.length)).fill(null));
      }
      for (var i = 0; i < Math.max(expected, r.ties.length); i++) {
        var t = r.ties[i];
        stack.appendChild(t ? tieBox(t, api) : placeholder(ri === 0 ? "To be decided" : "Winner of previous round"));
      }
      col.appendChild(stack); grid.appendChild(col);
    });
    var wrap = el("div", "bk-scroll"); wrap.appendChild(grid); box.appendChild(wrap);

    var tc = isFixed8 ? titleChances(rounds, api) : null;
    if (api.onTitleChances) api.onTitleChances(tc);
    if (tc) {
      var list = el("div", "bk-odds");
      list.appendChild(el("h3", null, "Title chances"));
      Object.keys(tc).sort(function (a, b) { return tc[b] - tc[a]; }).forEach(function (id) {
        var t = api.team(id); if (!t) return;
        var row = el("div", "bk-odd"), bar = el("div", "bk-bar"), fill = el("i");
        fill.style.width = (tc[id] * 100).toFixed(1) + "%"; bar.appendChild(fill);
        row.appendChild(el("span", "bk-name", t.name)); row.appendChild(bar); row.appendChild(el("b", "num", pct(tc[id])));
        list.appendChild(row);
      });
      list.appendChild(el("p", "note", "Worked out through the bracket from each tie's odds or season goal rates. Higher seeds host until the final, which is at a neutral venue."));
      box.appendChild(list);
    }
  }

  // Before the knockouts: who is where if the league phase ended today.
  function renderProjection(box, table, rules) {
    var grid = el("div", "bk-proj");
    rules.forEach(function (g) {
      var col = el("div", "bk-col"); col.appendChild(el("div", "eyebrow bk-round", g.label));
      var stack = el("div", "bk-list");
      table.filter(function (r) { return r.rank >= g.from && r.rank <= g.to; }).forEach(function (r) {
        var row = el("div", "bk-team" + (g.out ? " out" : ""));
        if (r.logo) { var im = new Image(); im.src = r.logo; im.alt = ""; im.loading = "lazy"; row.appendChild(im); }
        row.appendChild(el("span", "bk-seed num", String(r.rank))); row.appendChild(el("span", "bk-name", r.name)); row.appendChild(el("span", "bk-score num", r.pts + (r.pts === 1 ? " pt" : " pts")));
        stack.appendChild(row);
      });
      col.appendChild(stack);
      if (g.note) col.appendChild(el("p", "note", g.note));
      grid.appendChild(col);
    });
    box.appendChild(grid);
  }

  root.Bracket = { renderKnockout: renderKnockout, renderProjection: renderProjection, ties: ties };
})(this);
