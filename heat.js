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
            x: +p.fieldPositionX, y: +p.fieldPositionY, x2: p.fieldPosition2X == null ? null : +p.fieldPosition2X, y2: p.fieldPosition2Y == null ? null : +p.fieldPosition2Y,
            gy: p.goalPositionY == null ? null : +p.goalPositionY, gz: p.goalPositionZ == null ? null : +p.goalPositionZ,
            min: p.clock && p.clock.displayValue || "", text: p.text || "" });
        });
      });
      return out;
    });
  }


  // Pitch drawing: returns {wrap, svg}; the SVG viewBox is the pitch in metres (105 x 68).
  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, a, parent) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; }
  function pitch(box, label) {
    var wrap = el("div", "hm-pitch"); box.appendChild(wrap);
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
    return { wrap: wrap, svg: svg };
  }
  // metres from feed coordinates; flip turns a side round so it attacks left
  function mx(x, flip) { return (flip ? 100 - x : x) / 100 * L; }
  function my(y, flip) { return (flip ? y : 100 - y) / 100 * Wd; }

  // Density from weighted points [x, y, w] in feed coordinates. Drawn as blurred SVG cells, not canvas
  // pixels: Firefox's fingerprinting protection can blank canvas pixel data, and SVG follows the theme.
  var heatSeq = 0;
  function paintHeat(svg, pts, flip, color) {
    var GW = 105, GH = 68, grid = new Float32Array(GW * GH), r = 5, s2 = 2 * 3.2 * 3.2, i, j;
    var kern = []; for (j = -r * 2; j <= r * 2; j++) for (i = -r * 2; i <= r * 2; i++) { var w = Math.exp(-(i * i + j * j) / s2); if (w > 0.01) kern.push([i, j, w]); }
    pts.forEach(function (p) {
      var cx = Math.min(GW - 1, Math.floor(mx(p[0], flip))), cy = Math.min(GH - 1, Math.floor(my(p[1], flip))), wt = p[2] || 1;
      kern.forEach(function (k) { var x = cx + k[0], y = cy + k[1]; if (x >= 0 && y >= 0 && x < GW && y < GH) grid[y * GW + x] += k[2] * wt; });
    });
    // 3 m cells keep the element count low (35 x 23); the blur smooths them
    var C = 3, CW = Math.ceil(GW / C), CH = Math.ceil(GH / C), cells = new Float32Array(CW * CH), max = 0;
    for (j = 0; j < GH; j++) for (i = 0; i < GW; i++) { var k2 = Math.floor(j / C) * CW + Math.floor(i / C); cells[k2] += grid[j * GW + i]; }
    for (i = 0; i < cells.length; i++) if (cells[i] > max) max = cells[i];
    var id = "hmblur" + (++heatSeq), defs = sv("defs", {}, null);
    var f = sv("filter", { id: id, x: "-10%", y: "-10%", width: "120%", height: "120%" }, defs); sv("feGaussianBlur", { stdDeviation: 1.6 }, f);
    var clip = sv("clipPath", { id: id + "c" }, defs); sv("rect", { x: 0, y: 0, width: L, height: Wd }, clip);
    var g = sv("g", { filter: "url(#" + id + ")", fill: color }), outer = sv("g", { "clip-path": "url(#" + id + "c)" });
    for (j = 0; j < CH; j++) for (i = 0; i < CW; i++) {
      var v = max ? cells[j * CW + i] / max : 0;
      if (v < 0.04) continue;
      sv("rect", { x: i * C, y: j * C, width: C + 0.05, height: C + 0.05, "fill-opacity": Math.pow(v, 0.7).toFixed(3) }, g);
    }
    outer.appendChild(g);
    svg.insertBefore(outer, svg.firstChild); svg.insertBefore(defs, svg.firstChild);
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
  // A pass is progressive when it ends at least 25% closer to the opponent's goal, in the attacking half.
  function progressive(x, y, x2, y2) {
    // corners start on the goal line, and passes "ending" there mostly went out of play
    if (x2 == null || x2 < 50 || x2 >= 99 || x >= 99) return false;
    var d1 = Math.hypot((100 - x) * 1.05, (50 - y) * 0.68), d2 = Math.hypot((100 - x2) * 1.05, (50 - y2) * 0.68);
    return d2 <= 0.75 * d1;
  }
  // Arrows on a pitch: passes [{x, y, x2, y2, flip}]
  var arrowSeq = 0;
  function paintPasses(svg, passes, color) {
    var id = "hmarrow" + (++arrowSeq), defs = sv("defs", {}, null);
    var mk = sv("marker", { id: id, viewBox: "0 0 6 6", refX: 5, refY: 3, markerWidth: 4, markerHeight: 4, orient: "auto-start-reverse" }, defs);
    sv("path", { d: "M0,0 L6,3 L0,6 Z", fill: color }, mk);
    svg.appendChild(defs);
    var dense = passes.length > 60;
    var g = sv("g", { stroke: color, "stroke-width": dense ? 0.3 : 0.45, "stroke-linecap": "round", opacity: dense ? 0.55 : 0.85 }, svg);
    // passes recorded as ending on the goal line are mostly balls that went out of play
    passes.filter(function (p) { return p.x2 < 99 && p.x < 99; }).forEach(function (p) {
      sv("line", { x1: mx(p.x, p.flip), y1: my(p.y, p.flip), x2: mx(p.x2, p.flip), y2: my(p.y2, p.flip), "marker-end": "url(#" + id + ")" }, g);
      sv("circle", { cx: mx(p.x, p.flip), cy: my(p.y, p.flip), r: 0.45, fill: color, stroke: "none" }, g);
    });
  }
  // The goal from the shooter's side. Posts sit at about 44.6 and 55.4 across the pitch, the crossbar at about 38
  // on the feed's height scale; the attacker's left (higher numbers) is on the left.
  function goalMouth(box, shots, tip) {
    var Y0 = 64, Y1 = 36, Z1 = 62, W = 112, H = 46;
    function X(gy) { return (Y0 - gy) / (Y0 - Y1) * W; }
    function Z(gz) { return H - Math.min(gz, Z1) / Z1 * H; }
    var wrap = el("div", "hm-goal"); box.appendChild(wrap);
    var svg = sv("svg", { viewBox: "-2 -2 " + (W + 4) + " " + (H + 4), role: "img", "aria-label": "Where shots crossed the goal line, seen from the shooter's side" }, wrap);
    sv("line", { x1: -2, y1: H, x2: W + 2, y2: H, stroke: "currentColor", "stroke-width": 0.5, opacity: 0.5 }, svg);
    sv("path", { d: "M" + X(44.6) + "," + H + " V" + Z(38) + " H" + X(55.4) + " V" + H, fill: "none", stroke: "currentColor", "stroke-width": 1.2 }, svg);
    var g = sv("g", {}, svg), n = 0;
    shots.forEach(function (s) {
      if (s.gy == null || s.gz == null || s.gy > Y0 || s.gy < Y1) return;
      n++;
      var cx = X(s.gy), cy = Z(s.gz), m;
      if (s.kind === "goal") m = sv("circle", { cx: cx, cy: cy, r: 2.2, fill: s.color, stroke: "var(--panel)", "stroke-width": 0.5 }, g);
      else if (s.kind === "on") m = sv("circle", { cx: cx, cy: cy, r: 1.5, fill: s.color, stroke: "var(--panel)", "stroke-width": 0.4 }, g);
      else m = sv("circle", { cx: cx, cy: cy, r: 1.4, fill: "var(--panel)", "fill-opacity": 0.6, stroke: s.color, "stroke-width": 0.5 }, g);
      var hit = sv("circle", { cx: cx, cy: cy, r: 3, fill: "transparent" }, g);
      if (tip) { hit.addEventListener("pointermove", function (e) { tip(e, s.label); }); hit.addEventListener("pointerleave", function () { tip(null); }); }
    });
    return n;
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
      if (!plays.length) { box.appendChild(el("p", "note", "ESPN's play-by-play for this match has no pitch positions, so there's no heatmap or shot map." + (ctx.slug === "esp.w.1" ? " Liga F matches only list goals, cards and substitutions." : ""))); return; }
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
      if (v === "home" || v === "away") { var t = m[v]; pts = plays.filter(function (p) { return p.team === t.id; }); color = v === "home" ? "var(--home)" : "var(--away)"; who = t.name; }
      else { var aid = v.slice(2); pts = plays.filter(function (p) { return p.ath === aid; }); var tm = pts[0] && pts[0].team === m.away.id ? "away" : "home"; color = tm === "home" ? "var(--home)" : "var(--away)"; who = ctx.roster[aid] || "Player"; }
      var pt = pitch(left, "Heatmap of " + who + "'s touches, attacking to the right");
      paintHeat(pt.svg, pts.map(function (p) { return [p.x, p.y, 1]; }), false, color);
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
      // progressive passes for the same team or player as the touches
      var pcol = el("div", "hm-col"); grid.appendChild(pcol);
      var pb = el("div", "hm-bar"); pb.appendChild(el("b", "hm-title", "Progressive passes · " + who)); pcol.appendChild(pb);
      var passes = pts.filter(function (p) { return (p.type === "Pass" || p.type === "Cross") && p.x2 != null; });
      var prog = passes.filter(function (p) { return progressive(p.x, p.y, p.x2, p.y2); });
      var pp = pitch(pcol, "Progressive passes by " + who + ", attacking to the right");
      paintPasses(pp.svg, prog.map(function (p) { return { x: p.x, y: p.y, x2: p.x2, y2: p.y2, flip: false }; }), color);
      arrow(pcol, "Attacking →");
      pcol.appendChild(el("p", "note hm-cap", prog.length + " progressive of " + passes.length + " passes attempted (ESPN doesn't mark completed passes)"));
      // goal mouth for both teams
      var gcol = el("div", "hm-col"); grid.appendChild(gcol);
      var gb = el("div", "hm-bar"); gb.appendChild(el("b", "hm-title", "Goal mouth")); gcol.appendChild(gb);
      var gshots = plays.filter(function (p) { return p.shot && p.shot !== "blocked" && (p.team === m.home.id || p.team === m.away.id); }).map(function (p) {
        var home = p.team === m.home.id;
        return { gy: p.gy, gz: p.gz, kind: p.shot, color: home ? "var(--home)" : "var(--away)", label: (p.min ? p.min + "  " : "") + (ctx.roster[p.ath] || "") + " (" + (home ? m.home.abbr : m.away.abbr) + ")\n" + { goal: "Goal", on: "Saved", off: "Off target" }[p.shot] };
      });
      var shown = goalMouth(gcol, gshots, ctx.tip);
      gcol.appendChild(el("p", "note hm-cap", shown + " shots that reached the goal line, seen from the shooter's side. " + m.home.abbr + " in blue, " + m.away.abbr + " in orange."));
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
    paintHeat(p1.svg, pts, false, "var(--seq)");
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
    if (entry.pl) {
      var c = el("div", "hm-col"); grid.appendChild(c);
      var cb = el("div", "hm-bar"); cb.appendChild(el("b", "hm-title", "Progressive passes this season")); c.appendChild(cb);
      var p3 = pitch(c, "Season progressive passes, attacking to the right");
      paintPasses(p3.svg, entry.pl.map(function (q) { return { x: q[0], y: q[1], x2: q[2], y2: q[3], flip: false }; }), "var(--seq)");
      arrow(c, "Attacking →");
      c.appendChild(el("p", "note hm-cap", (entry.pp || 0) + " progressive of " + (entry.p || 0) + " passes attempted" + (entry.pl.length < entry.pp ? " · newest " + entry.pl.length + " shown" : "")));
    }
    if ((entry.s || []).some(function (q) { return q[5] != null; })) {
      var d = el("div", "hm-col"); grid.appendChild(d);
      var db = el("div", "hm-bar"); db.appendChild(el("b", "hm-title", "Goal mouth this season")); d.appendChild(db);
      var n = goalMouth(d, entry.s.filter(function (q) { return q[2] !== "blocked"; }).map(function (q) {
        return { gy: q[5], gz: q[6], kind: q[2], color: "var(--seq)", label: (q[4] ? q[4] + "  " : "") + (q[3] || "") + "\n" + { goal: "Goal", on: "Saved", off: "Off target" }[q[2]] };
      }), tip);
      d.appendChild(el("p", "note hm-cap", n + " shots that reached the goal line, seen from the shooter's side"));
    }
  }

  root.Heat = { loadPlays: loadPlays, matchPanel: matchPanel, seasonPanel: seasonPanel, shotKind: shotKind, pitch: pitch, paintHeat: paintHeat, paintPasses: paintPasses };
})(this);
