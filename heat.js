/* Heatmaps and shot maps from ESPN play-by-play coordinates.
   Coordinates are 0–100 along the pitch (own goal → opponent goal, for the team making the play)
   and 0–100 across it (100 = the attacking side's left). Drawn on a 105 × 68 m pitch. */
(function (root) {
  "use strict";
  var CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/";
  var L = 105, Wd = 68;
  // plays that are not on-ball actions at a spot, or that repeat another play
  var SKIP = /^(Substitution|Start Delay|End Delay|Halftime|Start 2nd Half|End Regular Time|Kickoff|Out|Corner Awarded|Drop of Ball|Assist|Assists Shot|End Extra Time|Start Extra Time)$/i;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function idFrom(ref, kind) { var m = String(ref || "").match(new RegExp(kind + "/(\\d+)")); return m ? m[1] : null; }

  function shotKind(t) {
    if (/^Own Goal/i.test(t)) return null;
    if (/^Goal($| - )/i.test(t) && !/Own Goal/i.test(t)) return "goal";  // not "Goal Kick"
    if (/^Shot On Target$|^Penalty - Saved$/i.test(t)) return "on";
    if (/^Shot Blocked$/i.test(t)) return "blocked";
    if (/^Shot Off Target$|^Penalty - Missed$|^Shot Hit Woodwork|Post/i.test(t)) return "off";
    return null;
  }

  // All plays of one match, with team, player, spot and minute. Two to three requests per match.
  function loadPlays(slug, eventId) {
    var base = CORE + slug + "/events/" + eventId + "/competitions/" + eventId + "/plays?limit=1000&page=";
    function page(n) { return fetch(base + n, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
    return page(1).then(function (first) {
      var more = [];
      for (var n = 2; n <= (first.pageCount || 1); n++) more.push(page(n));
      return Promise.all(more).then(function (rest) { return [first].concat(rest); });
    }).then(function (pages) {
      var out = [];
      pages.forEach(function (pg) {
        (pg.items || []).forEach(function (p) {
          var t = (p.type && p.type.text) || "";
          if (p.fieldPositionX == null || SKIP.test(t)) return;
          var part = p.participants && p.participants[0];
          out.push({ type: t, shot: shotKind(t), team: idFrom(p.team && p.team.$ref, "teams"), ath: part ? idFrom(part.athlete && part.athlete.$ref, "athletes") : null,
            x: +p.fieldPositionX, y: +p.fieldPositionY, min: p.clock && p.clock.displayValue || "", text: p.text || "" });
        });
      });
      return out;
    });
  }

  function cssVar(name, fallback) { var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; }
  function rgb(color) { var c = document.createElement("canvas").getContext("2d"); c.fillStyle = color; var h = c.fillStyle; if (h[0] === "#") return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; var m = h.match(/\d+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); }

  // Pitch drawing: returns {wrap, canvas, svg, X, Y} where X/Y map metres to pixels.
  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, a, parent) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; }
  function pitch(box, label) {
    var wrap = el("div", "hm-pitch"); box.appendChild(wrap);
    var W = Math.max(260, Math.round(wrap.clientWidth || box.clientWidth || 480)), H = Math.round(W * Wd / L);
    var cv = document.createElement("canvas"); cv.width = W * 2; cv.height = H * 2; cv.className = "hm-canvas"; wrap.appendChild(cv);
    var svg = sv("svg", { viewBox: "0 0 " + L + " " + Wd, class: "hm-lines", role: "img", "aria-label": label || "Pitch" }, wrap);
    var g = sv("g", { fill: "none", stroke: "currentColor", "stroke-width": 0.35 }, svg);
    sv("rect", { x: 0.2, y: 0.2, width: L - 0.4, height: Wd - 0.4 }, g);
    sv("line", { x1: L / 2, y1: 0, x2: L / 2, y2: Wd }, g);
    sv("circle", { cx: L / 2, cy: Wd / 2, r: 9.15 }, g);
    [0, 1].forEach(function (s) {
      var x0 = s ? L : 0, d = s ? -1 : 1;
      sv("rect", { x: s ? L - 16.5 : 0, y: (Wd - 40.3) / 2, width: 16.5, height: 40.3 }, g);
      sv("rect", { x: s ? L - 5.5 : 0, y: (Wd - 18.3) / 2, width: 5.5, height: 18.3 }, g);
      sv("circle", { cx: x0 + d * 11, cy: Wd / 2, r: 0.4, fill: "currentColor" }, g);
      sv("path", { d: "M" + (x0 + d * 16.5) + "," + (Wd / 2 - 7.3) + " A9.15,9.15 0 0," + (s ? 0 : 1) + " " + (x0 + d * 16.5) + "," + (Wd / 2 + 7.3) }, g);
      sv("rect", { x: s ? L : -1.2, y: Wd / 2 - 3.66, width: 1.2, height: 7.32 }, g);
    });
    sv("circle", { cx: L / 2, cy: Wd / 2, r: 0.4, fill: "currentColor" }, g);
    return { wrap: wrap, canvas: cv, svg: svg };
  }
  // metres from feed coordinates; flip turns a side round so it attacks left
  function mx(x, flip) { return (flip ? 100 - x : x) / 100 * L; }
  function my(y, flip) { return (flip ? y : 100 - y) / 100 * Wd; }

  // Density from weighted points [x, y, w] in feed coordinates, drawn as a single-hue ramp.
  function paintHeat(cv, pts, flip, color) {
    var ctx = cv.getContext("2d"), GW = 105, GH = 68, grid = new Float32Array(GW * GH), r = 5, s2 = 2 * 3.2 * 3.2, i, j;
    var kern = []; for (j = -r * 2; j <= r * 2; j++) for (i = -r * 2; i <= r * 2; i++) { var w = Math.exp(-(i * i + j * j) / s2); if (w > 0.01) kern.push([i, j, w]); }
    pts.forEach(function (p) {
      var cx = Math.round(mx(p[0], flip)), cy = Math.round(my(p[1], flip)), wt = p[2] || 1;
      kern.forEach(function (k) { var x = cx + k[0], y = cy + k[1]; if (x >= 0 && y >= 0 && x < GW && y < GH) grid[y * GW + x] += k[2] * wt; });
    });
    var max = 0; for (i = 0; i < grid.length; i++) if (grid[i] > max) max = grid[i];
    var img = ctx.createImageData(GW, GH), c = rgb(color);
    for (i = 0; i < grid.length; i++) {
      var v = max ? grid[i] / max : 0, a = v < 0.04 ? 0 : Math.pow(v, 0.7);
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = Math.round(a * 235);
    }
    var off = document.createElement("canvas"); off.width = GW; off.height = GH; off.getContext("2d").putImageData(img, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
  }

  // Shot markers. shots: [{x, y, kind, flip, color, label}]
  function paintShots(svg, shots, onHover) {
    var g = sv("g", {}, svg);
    shots.forEach(function (s) {
      var cx = mx(s.x, s.flip), cy = my(s.y, s.flip), m;
      if (s.kind === "goal") m = sv("circle", { cx: cx, cy: cy, r: 1.9, fill: s.color, stroke: "var(--panel)", "stroke-width": 0.5 }, g);
      else if (s.kind === "on") m = sv("circle", { cx: cx, cy: cy, r: 1.15, fill: s.color, stroke: "var(--panel)", "stroke-width": 0.35 }, g);
      else if (s.kind === "blocked") { m = sv("g", { stroke: s.color, "stroke-width": 0.5 }, g); sv("line", { x1: cx - 0.9, y1: cy - 0.9, x2: cx + 0.9, y2: cy + 0.9 }, m); sv("line", { x1: cx - 0.9, y1: cy + 0.9, x2: cx + 0.9, y2: cy - 0.9 }, m); }
      else m = sv("circle", { cx: cx, cy: cy, r: 1.05, fill: "var(--panel)", "fill-opacity": 0.6, stroke: s.color, "stroke-width": 0.45 }, g);
      var hit = sv("circle", { cx: cx, cy: cy, r: 2.6, fill: "transparent" }, g);
      if (onHover) { hit.addEventListener("pointermove", function (e) { onHover(e, s.label); }); hit.addEventListener("pointerleave", function () { onHover(null); }); }
    });
  }
  function arrow(box, text) { var a = el("div", "hm-dir"); a.appendChild(el("span", null, text)); box.appendChild(a); }
  function legend(box, items) {
    var lg = el("div", "hm-legend");
    items.forEach(function (it) { var s = el("span"); var k = el("i", "hm-key " + it[0]); if (it[2]) k.style.setProperty("--k", it[2]); s.appendChild(k); s.appendChild(document.createTextNode(it[1])); lg.appendChild(s); });
    box.appendChild(lg);
  }

  /* ---------- match centre ---------- */
  var mstate = { key: null, plays: null, view: "home", loading: false };
  function matchPanel(box, ctx) {
    // ctx: {slug, match, roster: {athleteId: name}, live, tip(e, text)}
    var m = ctx.match;
    if (m.state === "pre") { box.textContent = ""; box.appendChild(el("p", "note", "Heatmaps and the shot map appear once the match kicks off.")); mstate.key = null; return; }
    var key = ctx.slug + ":" + m.id;
    if (mstate.key !== key) { mstate = { key: key, plays: null, view: "home", loading: false, at: 0 }; }
    var stale = ctx.live && Date.now() - (mstate.at || 0) > 55000;
    if ((!mstate.plays || stale) && !mstate.loading) {
      mstate.loading = true;
      if (!mstate.plays) { box.textContent = ""; box.appendChild(el("p", "note", "Loading play-by-play…")); }
      loadPlays(ctx.slug, m.id).then(function (pl) { if (mstate.key !== key) return; mstate.plays = pl; mstate.at = Date.now(); mstate.loading = false; draw(); })
        .catch(function () { mstate.loading = false; if (mstate.key === key && !mstate.plays) { box.textContent = ""; box.appendChild(el("p", "note", "No play-by-play in the feed for this match.")); } });
      if (!mstate.plays) return;
    }
    draw();
    function draw() {
      var plays = mstate.plays || [];
      box.textContent = "";
      if (!plays.length) { box.appendChild(el("p", "note", "No play-by-play in the feed for this match.")); return; }
      var grid = el("div", "hm-grid"); box.appendChild(grid);
      // touches
      var left = el("div", "hm-col"); grid.appendChild(left);
      var bar = el("div", "hm-bar"); left.appendChild(bar);
      var sel = el("select", "pl-select"); sel.id = "hmView"; sel.setAttribute("aria-label", "Whose touches");
      sel.appendChild(new Option(m.home.name + " (team)", "home")); sel.appendChild(new Option(m.away.name + " (team)", "away"));
      [["home", m.home], ["away", m.away]].forEach(function (s) {
        var ids = {}; plays.forEach(function (p) { if (p.team === s[1].id && p.ath) ids[p.ath] = (ids[p.ath] || 0) + 1; });
        var og = document.createElement("optgroup"); og.label = s[1].name + " players";
        Object.keys(ids).map(function (a) { return [a, ctx.roster[a] || "Player " + a, ids[a]]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); })
          .forEach(function (a) { og.appendChild(new Option(a[1] + " (" + a[2] + ")", "p:" + a[0])); });
        sel.appendChild(og);
      });
      sel.value = mstate.view; if (sel.value !== mstate.view) { mstate.view = "home"; sel.value = "home"; }
      bar.appendChild(el("b", "hm-title", "Touches")); bar.appendChild(sel);
      sel.addEventListener("change", function () { mstate.view = sel.value; draw(); });
      var v = mstate.view, pts, color, who;
      if (v === "home" || v === "away") { var t = m[v]; pts = plays.filter(function (p) { return p.team === t.id; }); color = cssVar(v === "home" ? "--home" : "--away", "#2343D6"); who = t.name; }
      else { var aid = v.slice(2); pts = plays.filter(function (p) { return p.ath === aid; }); var tm = pts[0] && pts[0].team === m.away.id ? "away" : "home"; color = cssVar(tm === "home" ? "--home" : "--away", "#2343D6"); who = ctx.roster[aid] || "Player"; }
      var pt = pitch(left, "Heatmap of " + who + "'s touches, attacking to the right");
      paintHeat(pt.canvas, pts.map(function (p) { return [p.x, p.y, 1]; }), false, color);
      arrow(left, "Attacking →");
      left.appendChild(el("p", "note hm-cap", pts.length + " touches by " + who + (ctx.live ? " so far" : "")));
      // shots
      var right = el("div", "hm-col"); grid.appendChild(right);
      var sb = el("div", "hm-bar"); sb.appendChild(el("b", "hm-title", "Shot map")); right.appendChild(sb);
      var sp = pitch(right, "Shot map: " + m.home.name + " attacking right, " + m.away.name + " attacking left");
      var shots = plays.filter(function (p) { return p.shot && (p.team === m.home.id || p.team === m.away.id); }).map(function (p) {
        var home = p.team === m.home.id, outcome = { goal: "Goal", on: "Saved", off: "Off target", blocked: "Blocked" }[p.shot];
        return { x: p.x, y: p.y, kind: p.shot, flip: !home, color: home ? "var(--home)" : "var(--away)", label: (p.min ? p.min + "  " : "") + (ctx.roster[p.ath] || "") + " (" + (home ? m.home.abbr : m.away.abbr) + ")\n" + outcome };
      });
      paintShots(sp.svg, shots, ctx.tip);
      var count = function (id) { var s = shots.filter(function (x) { return (x.flip ? m.away.id : m.home.id) === id; }); return s.length + " shots, " + s.filter(function (x) { return x.kind === "goal" || x.kind === "on"; }).length + " on target"; };
      var cap = el("div", "hm-teams"); cap.appendChild(el("span", "hm-h", "← " + m.away.abbr + ": " + count(m.away.id))); cap.appendChild(el("span", "hm-a", m.home.abbr + ": " + count(m.home.id) + " →")); right.appendChild(cap);
      legend(right, [["goal", "Goal"], ["on", "Saved"], ["off", "Off target"], ["blocked", "Blocked"]]);
    }
  }

  /* ---------- player page (season grid from data/<slug>/heat.json) ---------- */
  function seasonPanel(box, entry, gridSize, tip) {
    box.textContent = "";
    if (!entry || !entry.n) { box.appendChild(el("p", "note", "No touch data for this player yet.")); return; }
    var gx = gridSize[0], gy = gridSize[1], pts = [];
    Object.keys(entry.c).forEach(function (k) { var i = +k, cx = (i % gx + 0.5) / gx * 100, cy = (Math.floor(i / gx) + 0.5) / gy * 100; pts.push([cx, cy, entry.c[k]]); });
    var grid = el("div", "hm-grid"); box.appendChild(grid);
    var a = el("div", "hm-col"); grid.appendChild(a);
    var ab = el("div", "hm-bar"); ab.appendChild(el("b", "hm-title", "Touches this season")); a.appendChild(ab);
    var p1 = pitch(a, "Season heatmap of touches, attacking to the right");
    paintHeat(p1.canvas, pts, false, cssVar("--seq", "#1D3FBF"));
    arrow(a, "Attacking →");
    a.appendChild(el("p", "note hm-cap", entry.n.toLocaleString() + " touches"));
    var b = el("div", "hm-col"); grid.appendChild(b);
    var bb = el("div", "hm-bar"); bb.appendChild(el("b", "hm-title", "Shots this season")); b.appendChild(bb);
    var p2 = pitch(b, "Season shot map, attacking to the right");
    var shots = (entry.s || []).map(function (s) { return { x: s[0], y: s[1], kind: s[2], flip: false, color: "var(--seq)", label: (s[4] ? s[4] + "  " : "") + (s[3] || "") + "\n" + { goal: "Goal", on: "Saved", off: "Off target", blocked: "Blocked" }[s[2]] }; });
    paintShots(p2.svg, shots, tip);
    var goals = shots.filter(function (s) { return s.kind === "goal"; }).length, on = shots.filter(function (s) { return s.kind === "on"; }).length;
    b.appendChild(el("p", "note hm-cap", shots.length + " shots · " + (goals + on) + " on target · " + goals + " goals"));
    legend(b, [["goal", "Goal", "var(--seq)"], ["on", "Saved", "var(--seq)"], ["off", "Off target", "var(--seq)"], ["blocked", "Blocked", "var(--seq)"]]);
  }

  root.Heat = { loadPlays: loadPlays, matchPanel: matchPanel, seasonPanel: seasonPanel, shotKind: shotKind };
})(this);
