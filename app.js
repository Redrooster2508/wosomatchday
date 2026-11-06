/* Matchday Hub: live scores, stats and probabilities from ESPN's public soccer feed. */
(function () {
  "use strict";
  var LEAGUES = {
    wsl: { slug: "eng.w.1", name: "Women's Super League" },
    ligaf: { slug: "esp.w.1", name: "Liga F" },
    nwsl: { slug: "usa.nwsl", name: "NWSL", fixedBracket: true,
      projection: [{ label: "Playoff places", from: 1, to: 8, note: "The top eight make the playoffs: 1 v 8, 2 v 7, 3 v 6, 4 v 5." }, { label: "Outside the playoffs", from: 9, to: 99, out: true }] },
    ucl: { slug: "uefa.wchampions", name: "Women's Champions League",
      projection: [
        { label: "Straight to quarter-finals", from: 1, to: 4, note: "The top four skip the knockout play-offs." },
        { label: "Knockout play-offs", from: 5, to: 12, note: "5th–8th are seeded against 9th–12th; opponents are decided by the draw." },
        { label: "Eliminated", from: 13, to: 99, out: true }] },
    // national teams (picked from the "National teams" tab)
    friendlies: { slug: "fifa.friendly.w", name: "International friendlies", intl: true },
    wcq: { slug: "fifa.wwcq.ply", name: "World Cup qualifying play-offs", intl: true },
    wchamp: { slug: "concacaf.womens.championship", name: "Concacaf W Championship", intl: true },
    wafcon: { slug: "caf.w.nations", name: "Women's Africa Cup of Nations", intl: true },
    asian: { slug: "afc.w.asian.cup", name: "AFC Women's Asian Cup", intl: true },
    wwc: { slug: "fifa.wwc", name: "FIFA Women's World Cup", intl: true },
    weuro: { slug: "uefa.weuro", name: "UEFA Women's Euro", intl: true },
    copa: { slug: "conmebol.america.femenina", name: "Copa América Femenina", intl: true },
    olympics: { slug: "fifa.w.olympics", name: "Olympic tournament", intl: true },
    wnl: { slug: "uefa.w.nations", name: "UEFA Women's Nations League", intl: true }
  };
  var SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
  var CORE = "https://site.api.espn.com/apis/v2/sports/soccer/";
  var LIVE_MS = 30000, SOON_MS = 60000, IDLE_MS = 300000, TABLE_MS = 600000;

  var state = { league: "wsl", date: null, day: null, matches: [], table: [], tableAt: 0, sel: null, summary: null, summaryFor: null, timer: null, loading: false };
  var fitCache = {};

  /* ---------- small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pct(p, d) { return (p * 100).toFixed(d == null ? 0 : d) + "%"; }
  function odds(p) { return p > 0 ? (1 / p).toFixed(2) : "—"; }
  function num(x) { var n = parseFloat(x); return isFinite(n) ? n : 0; }
  function ml(x) { if (x == null) return null; if (/^even$/i.test(String(x))) return 100; var n = parseFloat(String(x).replace("+", "")); return isFinite(n) ? n : null; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function ymd(d) { return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); }
  function parseDay(s) { var p = String(s).slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var fmtTime = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  var fmtDay = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
  var fmtClock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  var tip = $("tip");
  function showTip(e, txt) {
    tip.textContent = txt; tip.hidden = false;
    var x = e.clientX + 14, y = e.clientY + 14, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  }
  function hideTip() { tip.hidden = true; }
  function bindTip(node, txt) { node.addEventListener("pointermove", function (e) { showTip(e, typeof txt === "function" ? txt(e) : txt); }); node.addEventListener("pointerleave", hideTip); }

  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  /* ---------- parsing the feed ---------- */
  function parseTeam(cp) {
    var t = cp.team || {};
    return {
      id: String(t.id), name: (t.shortDisplayName || t.displayName || t.name || "").trim(), full: t.displayName || t.name || "",
      abbr: t.abbreviation || "", logo: t.logo || (t.logos && t.logos[0] && t.logos[0].href) || "",
      color: t.color, alternateColor: t.alternateColor, score: cp.score != null ? parseInt(cp.score, 10) || 0 : 0,
      winner: !!cp.winner, record: cp.records && cp.records[0] ? cp.records[0].summary : ""
    };
  }
  function parseOdds(o) {
    if (!o) return null;
    var m = o.moneyline || {};
    var h = ml(m.home && m.home.close && m.home.close.odds), d = ml(m.draw && m.draw.close && m.draw.close.odds), a = ml(m.away && m.away.close && m.away.close.odds);
    if (h == null && o.homeTeamOdds) h = ml(o.homeTeamOdds.moneyLine);
    if (a == null && o.awayTeamOdds) a = ml(o.awayTeamOdds.moneyLine);
    if (d == null && o.drawOdds) d = ml(o.drawOdds.moneyLine);
    var fair = Model.fairProbs(h, d, a);
    if (!fair) return null;
    return { fair: fair, provider: (o.provider && (o.provider.displayName || o.provider.name)) || "Bookmaker", key: h + "/" + d + "/" + a };
  }
  function parseDetails(list, homeId) {
    return (list || []).map(function (d) {
      var sec = d.clock && d.clock.value != null ? num(d.clock.value) : 0;
      return {
        min: Math.max(1, Math.ceil(sec / 60)), label: d.clock && d.clock.displayValue || "",
        side: d.team && String(d.team.id) === homeId ? "h" : "a",
        goal: !!d.scoringPlay && !d.shootout, own: !!d.ownGoal, red: !!d.redCard, yellow: !!d.yellowCard,
        pen: !!d.penaltyKick, who: (d.athletesInvolved || []).map(function (a) { return a.displayName || a.shortName; }).join(", ")
      };
    });
  }
  function parseMatch(ev) {
    var c = ev.competitions[0], st = c.status || ev.status || {}, ty = st.type || {};
    var cps = c.competitors || [], hc = cps.find(function (x) { return x.homeAway === "home"; }) || cps[0], ac = cps.find(function (x) { return x.homeAway === "away"; }) || cps[1];
    var home = parseTeam(hc), away = parseTeam(ac);
    var m = {
      id: String(ev.id), date: ev.date, state: ty.state || "pre", statusName: ty.name || "", detail: ty.shortDetail || ty.detail || "",
      clock: num(st.clock), displayClock: st.displayClock || "", period: st.period || 0,
      venue: (c.venue && c.venue.fullName) || (ev.venue && ev.venue.fullName) || "", neutral: !!c.neutralSite,
      home: home, away: away, odds: parseOdds(c.odds && c.odds[0]), details: parseDetails(c.details, home.id),
      note: c.notes && c.notes[0] && c.notes[0].headline || "",
      round: ev.season && ev.season.slug || ""
    };
    hc && (home.form = hc.form || ""); ac && (away.form = ac.form || "");
    return m;
  }
  // One table per group for tournaments; a single table for leagues.
  function parseTable(data) {
    var groups = (data.children && data.children.length ? data.children : [data]).map(function (ch) {
      return { name: data.children && data.children.length > 1 ? ch.name || ch.abbreviation || "" : "", rows: parseRows((ch.standings && ch.standings.entries) || []) };
    }).filter(function (g) { return g.rows.length; });
    var ch0 = (data.children && data.children[0]) || data;
    return { rows: [].concat.apply([], groups.map(function (g) { return g.rows; })), groups: groups, season: data.name || (ch0 && ch0.name) || "" };
  }
  function parseRows(entries) {
    var rows = entries.map(function (e) {
      var s = {}; (e.stats || []).forEach(function (x) { s[x.name] = x.value != null ? x.value : num(x.displayValue); });
      var t = e.team || {};
      return {
        id: String(t.id), name: (t.shortDisplayName || t.displayName || "").trim(), abbr: t.abbreviation, logo: t.logos && t.logos[0] && t.logos[0].href,
        rank: s.rank || 0, gp: s.gamesPlayed || 0, w: s.wins || 0, d: s.ties || 0, l: s.losses || 0, gf: s.pointsFor || 0, ga: s.pointsAgainst || 0,
        gd: s.pointDifferential || 0, pts: s.points || 0, note: e.note || null
      };
    });
    rows.sort(function (a, b) { return (a.rank || 99) - (b.rank || 99) || b.pts - a.pts; });
    return rows;
  }

  /* ---------- probability for one match ---------- */
  function baseRates(m) {
    var intl = LEAGUES[state.league].intl && state.intlForm && state.intlForm.length;
    var formL = Model.formLambdas(intl ? state.intlForm : state.table, m.home.id, m.away.id, m.neutral);
    var odds = m.odds || (state.summaryFor === m.id && state.summary && state.summary.odds) || null;
    if (odds) {
      var k = m.id + ":" + odds.key;
      if (!fitCache[k]) fitCache[k] = Model.fitLambdas(odds.fair.H, odds.fair.A);
      return { lh: fitCache[k].lh, la: fitCache[k].la, source: odds.provider + " odds, margin removed", market: odds.fair, form: formL };
    }
    if (formL) return { lh: formL.lh, la: formL.la, source: intl ? "This year's international results (no odds listed)" : "Season goals model (no odds listed)", market: null, form: formL };
    return { lh: 1.35, la: 1.1, source: intl ? "League-average rates (not enough international results this year)" : "League-average rates (no odds or table yet)", market: null, form: null };
  }
  function minuteOf(m) {
    if (/HALFTIME/.test(m.statusName)) return 45;
    var mm = m.clock / 60;
    if (!mm && m.displayClock) mm = parseInt(m.displayClock, 10) || 0;
    return mm;
  }
  // Goals and red cards in order, with own-goal sides fixed so the replay ends on the real score.
  function timeline(m) {
    var evs = [];
    m.details.forEach(function (d) {
      if (d.goal) evs.push({ min: d.min, type: "goal", side: d.side, own: d.own });
      if (d.red) evs.push({ min: d.min, type: "red", side: d.side });
    });
    function tally() { var h = 0, a = 0; evs.forEach(function (e) { if (e.type === "goal") { if (e.side === "h") h++; else a++; } }); return [h, a]; }
    var t = tally();
    if ((t[0] !== m.home.score || t[1] !== m.away.score) && evs.some(function (e) { return e.own; })) {
      evs.forEach(function (e) { if (e.own) e.side = e.side === "h" ? "a" : "h"; });
    }
    return evs;
  }
  function probs(m) {
    var b = baseRates(m);
    if (m.state === "in") {
      var evs = timeline(m), rh = 0, ra = 0;
      evs.forEach(function (e) { if (e.type === "red") { if (e.side === "h") rh++; else ra++; } });
      var mins = minuteOf(m), r = Model.liveRates(b.lh, b.la, mins, rh, ra);
      return { live: true, minute: mins, base: b, rates: r, o: Model.outcome(r.lh, r.la, m.home.score, m.away.score), pre: Model.outcome(b.lh, b.la, 0, 0) };
    }
    var pre = Model.outcome(b.lh, b.la, 0, 0);
    return { live: false, base: b, rates: { lh: b.lh, la: b.la }, o: pre, pre: pre };
  }

  /* ---------- rendering: fixtures ---------- */
  function pbar(node, o) {
    node.textContent = "";
    [["ph", o.H], ["pd", o.D], ["pa", o.A]].forEach(function (s) { var i = el("i", s[0]); i.style.flex = s[1] + " 0 0"; node.appendChild(i); });
  }
  function statusChip(m) {
    if (m.state === "in") { var c = el("span", "chip live"); c.appendChild(el("span", "dot pulse")); c.appendChild(document.createTextNode(/HALFTIME/.test(m.statusName) ? "HT" : (m.displayClock || "Live"))); return c; }
    if (m.state === "post") return el("span", "chip", m.detail || "FT");
    if (/POSTPONED|CANCELED|SUSPENDED|DELAYED/.test(m.statusName)) return el("span", "chip", m.detail);
    return el("span", "chip", fmtTime.format(new Date(m.date)));
  }
  function renderFixtures() {
    var box = $("fixtures"); box.textContent = "";
    if (!state.matches.length) {
      box.appendChild(el("div", "empty", state.loading ? "Loading matches…" : "No matches on this day. Use the arrows to move between days, or jump back to the current matchday."));
      return;
    }
    state.matches.forEach(function (m) {
      var p = probs(m), b = el("button", "fx"); b.type = "button";
      b.setAttribute("aria-pressed", String(state.sel === m.id));
      var top = el("div", "fx-top"), venue = el("span", "venue", m.venue); venue.title = m.venue;
      top.appendChild(statusChip(m)); top.appendChild(venue); b.appendChild(top);
      [["home", m.home], ["away", m.away]].forEach(function (x) {
        var t = x[1], other = x[0] === "home" ? m.away : m.home, row = el("div", "fx-row");
        if (m.state === "post" && t.score < other.score) row.classList.add("lost");
        if (t.logo) { var im = new Image(); im.src = t.logo; im.alt = ""; im.loading = "lazy"; row.appendChild(im); }
        else row.appendChild(el("span", "crest-none", (t.abbr || t.name || "?").slice(0, 3)));
        row.appendChild(el("span", "nm", t.name));
        row.appendChild(el("span", "sc num", m.state === "pre" ? "" : String(t.score)));
        b.appendChild(row);
      });
      var bar = el("div", "pbar"); pbar(bar, p.o); b.appendChild(bar);
      var lab = el("div", "plab");
      [["H ", p.o.H], ["D ", p.o.D], ["A ", p.o.A]].forEach(function (s) { var sp = el("span", null, s[0]); sp.appendChild(el("b", null, pct(s[1]))); lab.appendChild(sp); });
      lab.appendChild(el("span", null, p.live ? "live" : m.state === "post" ? "pre-match" : ""));
      b.appendChild(lab);
      b.setAttribute("aria-label", m.home.name + " v " + m.away.name + ". " + (m.state === "pre" ? "Kick-off " + fmtTime.format(new Date(m.date)) : m.home.score + "–" + m.away.score + ", " + m.detail) + ". Home " + pct(p.o.H) + ", draw " + pct(p.o.D) + ", away " + pct(p.o.A));
      b.addEventListener("click", function () { select(m.id, true); });
      box.appendChild(b);
    });
  }

  /* ---------- rendering: match centre ---------- */
  function tableRow(id) { return state.table.find(function (r) { return r.id === id; }); }
  function ord(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function lastFive(teamId) {
    var s = state.summary; if (!s || !s.raw.lastFiveGames) return null;
    var t = s.raw.lastFiveGames.find(function (x) { return x.team && String(x.team.id) === teamId; });
    if (!t || !t.events) return null;
    return t.events.slice().sort(function (a, b) { return new Date(a.gameDate) - new Date(b.gameDate); }).map(function (e) {
      return { r: e.gameResult, txt: (e.atVs === "@" ? "at " : "v ") + ((e.opponent && e.opponent.abbreviation) || "") + " " + (e.score || "") };
    });
  }
  function leaders(teamId) {
    var s = state.summary; if (!s || !s.raw.leaders) return [];
    var t = s.raw.leaders.find(function (x) { return x.team && String(x.team.id) === teamId; });
    if (!t || !t.leaders) return [];
    var out = [];
    t.leaders.forEach(function (cat) {
      var top = cat.leaders && cat.leaders[0];
      // displayValue reads like "Matches: 6, Goals: 6"; the last number is the stat itself
      var v = String(top && top.displayValue || "").match(/(\d+(?:\.\d+)?)\s*$/);
      if (top && top.athlete && out.length < 3) out.push({ cat: cat.displayName || cat.name, who: top.athlete.displayName, val: v ? v[1] : "" });
    });
    return out;
  }
  function renderSide(node, m, side) {
    var t = m[side], row = tableRow(t.id); node.textContent = "";
    var ph = el("div", "photo"), im = new Image(); im.className = "ph-img"; im.src = Photos.get(t);
    im.alt = Photos.isPhoto(t.id) ? t.name + " team photo" : "Illustrated squad line-up in " + t.name + " colours";
    ph.appendChild(im); Photos.frame(ph, im, t.id);
    if (t.logo) { var cr = new Image(); cr.className = "crest"; cr.src = t.logo; cr.alt = t.name + " crest"; ph.appendChild(cr); }
    ph.appendChild(el("span", "tag", m.neutral ? (side === "home" ? "Team A" : "Team B") : (side === "home" ? "Home" : "Away")));
    node.appendChild(ph);
    var cr = Photos.credit(t.id);
    if (cr) {
      var cap = el("div", "ph-credit", "Photo: ");
      if (cr.source) { var a = el("a", null, cr.text); a.href = cr.source; a.target = "_blank"; a.rel = "noopener"; cap.appendChild(a); }
      else cap.appendChild(document.createTextNode(cr.text));
      node.appendChild(cap);
    }
    var act = el("div", "ph-actions"), up = el("button", "btn", Photos.hasUpload(t.id) ? "Replace photo" : "Upload team photo"); up.type = "button";
    up.addEventListener("click", function () { uploadFor = t.id; $("fileIn").value = ""; $("fileIn").click(); });
    act.appendChild(up);
    if (Photos.hasUpload(t.id)) { var rs = el("button", "btn", "Remove my photo"); rs.type = "button"; rs.addEventListener("click", function () { Photos.clear(t.id); renderMatch(); }); act.appendChild(rs); }
    node.appendChild(act);
    var tn = el("a", "tname pl-link", t.name); tn.href = "team.html?l=" + encodeURIComponent(LEAGUES[state.league].slug) + "&id=" + encodeURIComponent(t.id); node.appendChild(tn);
    var meta = row ? ord(row.rank) + " · " + row.pts + (row.pts === 1 ? " pt · " : " pts · ") + row.w + "W " + row.d + "D " + row.l + "L · GD " + (row.gd > 0 ? "+" : "") + row.gd : (t.record || "");
    node.appendChild(el("div", "tmeta", meta));
    var lf = lastFive(t.id);
    if (lf && lf.length) {
      var f = el("div", "form"); f.setAttribute("aria-label", "Last five, oldest first");
      lf.forEach(function (g) { var s = el("span", g.r || "D", g.r || "?"); bindTip(s, g.txt); f.appendChild(s); });
      node.appendChild(f);
    }
    var ld = leaders(t.id);
    if (ld.length) {
      var box = el("div", "scorers");
      ld.forEach(function (x) { var r = el("div", "scorer"); r.appendChild(el("span", null, x.cat + " · " + x.who)); r.appendChild(el("b", null, x.val)); box.appendChild(r); });
      node.appendChild(box);
    }
  }
  function renderMatch() {
    var m = state.matches.find(function (x) { return x.id === state.sel; });
    $("matchup").hidden = !m;
    if (!m) return;
    var p = probs(m), o = p.o, h = m.home, a = m.away;
    $("muMeta").textContent = [m.venue, m.state === "pre" ? fmtTime.format(new Date(m.date)) : m.detail, m.note].filter(Boolean).join(" · ");
    renderSide($("sideH"), m, "home"); renderSide($("sideA"), m, "away");
    var chip = $("probState"); chip.textContent = ""; chip.className = "chip";
    if (p.live) { chip.classList.add("live"); chip.appendChild(el("span", "dot pulse")); chip.appendChild(document.createTextNode("Live · " + (/HALFTIME/.test(m.statusName) ? "half-time" : m.displayClock))); }
    else chip.textContent = m.state === "post" ? "Full time · pre-match chances" : "Pre-match";
    $("probSource").textContent = p.base.source;
    $("pH").textContent = pct(o.H); $("pD").textContent = pct(o.D); $("pA").textContent = pct(o.A);
    $("oH").textContent = "Fair odds " + odds(o.H); $("oD").textContent = "Fair odds " + odds(o.D); $("oA").textContent = "Fair odds " + odds(o.A);
    pbar($("bigBar"), o);
    var cmp = $("compare"); cmp.textContent = "";
    function line(label, x) { var d = el("div"); d.appendChild(el("span", null, label)); d.appendChild(el("b", "num", pct(x.H) + " · " + pct(x.D) + " · " + pct(x.A))); cmp.appendChild(d); }
    if (p.live) line("Pre-match", p.pre);
    if (p.base.market && p.base.form) { var fo = Model.outcome(p.base.form.lh, p.base.form.la, 0, 0); line("Season goals model", fo); }
    $("xgH").textContent = (p.live ? p.rates.lh : p.base.lh).toFixed(2);
    $("xgA").textContent = (p.live ? p.rates.la : p.base.la).toFixed(2);
    $("scoreNow").textContent = m.state === "pre" ? "v" : h.score + "–" + a.score;
    $("xgH").parentNode.firstChild.textContent = p.live ? "Goals to come " : "Exp. goals ";
    $("xgA").parentNode.lastChild.textContent = p.live ? " Goals to come" : " Exp. goals";
    renderHeat(m, o, p.live);
    var mk = $("markets"); mk.textContent = "";
    [["Most likely final", o.best[0] + "–" + o.best[1] + " (" + pct(o.bestP) + ")"], ["Over 2.5 goals", pct(o.over25)], ["Both teams score", pct(o.btts)],
     ["Under 2.5 goals", pct(1 - o.over25)], [h.abbr + " clean sheet", pct(o.csHome)], [a.abbr + " clean sheet", pct(o.csAway)]].forEach(function (x) {
      var d = el("div"); d.appendChild(el("span", null, x[0])); d.appendChild(el("b", "num", x[1])); mk.appendChild(d);
    });
    renderFlow(m, p);
    renderStats(m);
    Players.lineups($("lineups"), state.summaryFor === m.id && state.summary ? state.summary.raw : null, m, LEAGUES[state.league].slug);
    var roster = {};
    ((state.summaryFor === m.id && state.summary && state.summary.raw.rosters) || []).forEach(function (r) { (r.roster || []).forEach(function (p) { if (p.athlete) roster[String(p.athlete.id)] = p.athlete.displayName; }); });
    Heat.matchPanel($("pitchHeat"), { slug: LEAGUES[state.league].slug, match: m, roster: roster, live: m.state === "in", tip: function (e, t) { if (e) showTip(e, t); else hideTip(); } });
    renderTimeline(m);
    renderH2H(m);
  }
  var h2hFor = null;
  function renderH2H(m) {
    var key = state.league + ":" + m.home.id + ":" + m.away.id;
    if (h2hFor === key) return;
    h2hFor = key;
    var box = $("h2h"); box.textContent = ""; box.appendChild(el("p", "note", "Loading meetings…"));
    H2H.load(LEAGUES[state.league].slug, m.home.id, m.away.id).then(function (ms) { if (h2hFor === key) H2H.render(box, ms.filter(function (x) { return x.id !== m.id; }), m.home.id, m.home.name, m.away.name); });
  }
  function renderHeat(m, o, live) {
    var hm = $("heat"); hm.textContent = ""; hm.appendChild(el("span", "ax", ""));
    var h0 = live ? Math.max(0, m.home.score - 2) : 0, a0 = live ? Math.max(0, m.away.score - 2) : 0, i, j, max = 0;
    for (j = 0; j < 6; j++) hm.appendChild(el("span", "ax", String(a0 + j)));
    for (i = 0; i < 6; i++) for (j = 0; j < 6; j++) max = Math.max(max, o.final[(h0 + i) + "-" + (a0 + j)] || 0);
    for (i = 0; i < 6; i++) {
      hm.appendChild(el("span", "ax", String(h0 + i)));
      for (j = 0; j < 6; j++) (function (fh, fa) {
        var q = o.final[fh + "-" + fa] || 0, c = el("span", "c", q >= 0.005 ? (q * 100).toFixed(q >= 0.1 ? 0 : 1) : "");
        var w = max ? Math.round(6 + 88 * (q / max)) : 6;
        c.style.background = "color-mix(in oklab, var(--seq) " + w + "%, var(--panel))";
        c.style.color = w > 52 ? "#fff" : "var(--ink)";
        if (fh === o.best[0] && fa === o.best[1]) c.classList.add("best");
        c.setAttribute("role", "cell"); c.setAttribute("aria-label", m.home.abbr + " " + fh + ", " + m.away.abbr + " " + fa + ": " + pct(q, 1));
        bindTip(c, m.home.name + " " + fh + "–" + fa + " " + m.away.name + "\n" + pct(q, 1) + (q > 0 ? " · fair odds " + odds(q) : " · not possible from here"));
        hm.appendChild(c);
      })(h0 + i, a0 + j);
    }
  }

  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function renderFlow(m, p) {
    var box = $("flow"); box.textContent = "";
    if (m.state === "pre") { box.appendChild(el("p", "note", "The chart starts at kick-off and updates with every goal and red card.")); return; }
    var upto = m.state === "post" ? Model.MATCH_MIN : Math.floor(p.minute), evs = timeline(m);
    var pts = Model.flow(p.base.lh, p.base.la, evs, upto);
    var W = Math.max(280, box.clientWidth || 560), H = 220, ml = 34, mr = 10, mt = 18, mb = 26;
    function X(min) { return ml + min / Model.MATCH_MIN * (W - ml - mr); }
    function Y(v) { return mt + (1 - v) * (H - mt - mb); }
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "Home, draw and away win probability by minute" }, box);
    [0, 0.25, 0.5, 0.75, 1].forEach(function (v) { sv("line", { x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), class: "grid" }, svg); sv("text", { x: ml - 6, y: Y(v) + 4, "text-anchor": "end" }, svg).textContent = (v * 100) + "%"; });
    [0, 15, 30, 45, 60, 75, 90].forEach(function (v) { sv("text", { x: X(v), y: H - 8, "text-anchor": "middle" }, svg).textContent = v + "'"; });
    function area(lo, hi, fill) {
      var d = "M" + pts.map(function (q) { return X(q.min) + "," + Y(hi(q)); }).join("L") + "L" + pts.slice().reverse().map(function (q) { return X(q.min) + "," + Y(lo(q)); }).join("L") + "Z";
      sv("path", { d: d, fill: fill, stroke: "var(--panel)", "stroke-width": 1.5 }, svg);
    }
    area(function () { return 0; }, function (q) { return q.H; }, "var(--home)");
    area(function (q) { return q.H; }, function (q) { return q.H + q.D; }, "var(--draw)");
    area(function (q) { return q.H + q.D; }, function () { return 1; }, "var(--away)");
    evs.filter(function (e) { return e.type === "goal"; }).forEach(function (e) {
      if (e.min > upto) return;
      var q = pts[Math.min(e.min, pts.length - 1)];
      sv("line", { x1: X(e.min), x2: X(e.min), y1: mt - 4, y2: H - mb, stroke: "var(--ink)", "stroke-width": 1.5 }, svg);
      sv("text", { x: X(e.min), y: mt - 6, "text-anchor": "middle", style: "fill:var(--ink)" }, svg).textContent = q.gh + "–" + q.ga;
    });
    evs.filter(function (e) { return e.type === "red"; }).forEach(function (e) { sv("rect", { x: X(e.min) - 3, y: H - mb - 10, width: 6, height: 9, fill: "var(--loss)", rx: 1 }, svg); });
    var cross = sv("line", { x1: 0, x2: 0, y1: mt, y2: H - mb, class: "now", visibility: "hidden" }, svg);
    var hit = sv("rect", { x: ml, y: mt, width: W - ml - mr, height: H - mt - mb, fill: "transparent" }, svg);
    hit.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
      var min = Math.round((x - ml) / (W - ml - mr) * Model.MATCH_MIN), q = pts[Math.max(0, Math.min(pts.length - 1, min))];
      cross.setAttribute("x1", X(q.min)); cross.setAttribute("x2", X(q.min)); cross.setAttribute("visibility", "visible");
      showTip(e, q.min + "'  " + q.gh + "–" + q.ga + "\n" + m.home.abbr + " " + pct(q.H) + " · Draw " + pct(q.D) + " · " + m.away.abbr + " " + pct(q.A));
    });
    hit.addEventListener("pointerleave", function () { cross.setAttribute("visibility", "hidden"); hideTip(); });
  }

  var STAT_ROWS = [
    { label: "Possession %", find: ["Possession"], dec: 1 },
    { label: "Shots", find: ["SHOTS", "Shots", "Total Shots"] },
    { label: "Shots on target", find: ["ON GOAL", "Shots on Target", "On Target"] },
    { label: "Corners", find: ["Corner Kicks", "Corners"] },
    { label: "Passes", find: ["Passes"] },
    { label: "Pass accuracy %", calc: function (s) { return s["Passes"] ? 100 * num(s["Accurate Passes"]) / num(s["Passes"]) : null; }, dec: 0 },
    { label: "Saves", find: ["Saves"] },
    { label: "Tackles won", find: ["Effective Tackles"] },
    { label: "Interceptions", find: ["Interceptions"] },
    { label: "Fouls", find: ["Fouls"], lowGood: true },
    { label: "Offsides", find: ["Offsides"], lowGood: true },
    { label: "Yellow cards", find: ["Yellow Cards"], lowGood: true },
    { label: "Red cards", find: ["Red Cards"], lowGood: true }
  ];
  function renderStats(m) {
    var box = $("stats"); box.textContent = "";
    var s = state.summaryFor === m.id && state.summary;
    var teams = s && s.raw.boxscore && s.raw.boxscore.teams || [];
    if (m.state === "pre" || teams.length < 2) { $("statsNote").textContent = ""; box.appendChild(el("p", "note", m.state === "pre" ? "Stats appear once the match kicks off." : "Loading match stats…")); return; }
    $("statsNote").textContent = m.state === "in" ? "Updates every 30 s" : "Final";
    var byId = {}; teams.forEach(function (t) { var o = {}; (t.statistics || []).forEach(function (x) { o[x.label] = x.displayValue; o[x.name] = x.displayValue; }); byId[String(t.team.id)] = o; });
    var H = byId[m.home.id] || {}, A = byId[m.away.id] || {}, shown = 0;
    STAT_ROWS.forEach(function (r) {
      function val(o) { if (r.calc) return r.calc(o); for (var i = 0; i < r.find.length; i++) if (o[r.find[i]] != null) return num(o[r.find[i]]); return null; }
      var hv = val(H), av = val(A);
      if (hv == null || av == null) return;
      shown++;
      var row = el("div", "st-row"), tot = hv + av, hs = tot ? hv / tot : 0.5;
      var hLead = r.lowGood ? hv < av : hv > av, aLead = r.lowGood ? av < hv : av > hv;
      row.appendChild(el("span", "lbl", r.label));
      row.appendChild(el("span", "v h" + (hLead ? " lead" : ""), hv.toFixed(r.dec || 0)));
      var bar = el("div", "st-bar"), bi = el("i", "h"), ai = el("i", "a");
      bi.style.flex = (tot ? hs : 0.5) + " 0 0"; ai.style.flex = (tot ? 1 - hs : 0.5) + " 0 0";
      if (!tot) { bi.style.opacity = ai.style.opacity = ".25"; }
      bar.appendChild(bi); bar.appendChild(ai); row.appendChild(bar);
      row.appendChild(el("span", "v" + (aLead ? " lead" : ""), av.toFixed(r.dec || 0)));
      bindTip(bar, r.label + "\n" + m.home.name + " " + hv.toFixed(r.dec || 0) + " · " + m.away.name + " " + av.toFixed(r.dec || 0));
      box.appendChild(row);
    });
    if (!shown) box.appendChild(el("p", "note", "The feed has no detailed stats for this match."));
  }
  function renderTimeline(m) {
    var box = $("timeline"); box.textContent = "";
    var s = state.summaryFor === m.id && state.summary, ke = s && s.raw.keyEvents || [];
    // goals, cards, substitutions, penalties and the half markers; injury delays and restarts are left out
    var items = ke.filter(function (e) {
      var t = (e.type && (e.type.type || e.type.text) || "") + " " + (e.text || "");
      if (/delay/i.test(t)) return false;
      return e.scoringPlay || /goal|card|substitution|penalty|half|kickoff|end-regular|full.?time/i.test(t);
    });
    if (!items.length) {
      m.details.forEach(function (d) { items.push({ _d: d }); });
    }
    if (!items.length) { box.appendChild(el("li", "note empty-row", m.state === "pre" ? "Goals, cards and substitutions will appear here." : "No events yet.")); return; }
    items.slice().reverse().forEach(function (e) {
      var li = el("li"), kind = "other", text, min, team = "";
      if (e._d) {
        var d = e._d; min = d.label; kind = d.goal ? "goal" : d.red ? "red" : d.yellow ? "yellow" : "other";
        text = (d.goal ? (d.own ? "Own goal" : d.pen ? "Penalty goal" : "Goal") : d.red ? "Red card" : d.yellow ? "Yellow card" : "Event") + (d.who ? " · " + d.who : "");
        team = d.side === "h" ? m.home.abbr : m.away.abbr;
      } else {
        var t = e.type && e.type.type || "";
        kind = e.scoringPlay ? "goal" : /red/.test(t) ? "red" : /yellow/.test(t) ? "yellow" : /substitution/.test(t) ? "sub" : "other";
        min = e.clock && e.clock.displayValue || "";
        text = e.text || e.shortText || (e.type && e.type.text) || "";
        if (e.team) team = String(e.team.id) === m.home.id ? m.home.abbr : String(e.team.id) === m.away.id ? m.away.abbr : "";
      }
      li.appendChild(el("span", "min", min));
      var ic = el("span", "ic " + kind); ic.setAttribute("aria-label", kind); li.appendChild(ic);
      var tx = el("span", "txt"); if (team) tx.appendChild(el("span", "tm", team)); tx.appendChild(document.createTextNode(text)); li.appendChild(tx);
      box.appendChild(li);
    });
  }

  /* ---------- rendering: table ---------- */
  function renderTable() {
    var tb = $("table"); tb.textContent = "";
    var m = state.matches.find(function (x) { return x.id === state.sel; });
    $("tblH").closest("section").hidden = !state.table.length;
    if (!state.table.length) { $("tblNote").textContent = ""; return; }
    var thead = el("thead"), tr = el("tr");
    [["#", ""], ["Club", "l club"], ["P", ""], ["W", ""], ["D", ""], ["L", ""], ["GF", ""], ["GA", ""], ["GD", ""], ["Pts", ""], ["Scored/gm", "wide"], ["Conceded/gm", "wide"]].forEach(function (c) { tr.appendChild(el("th", c[1], c[0])); });
    thead.appendChild(tr); tb.appendChild(thead);
    var body = el("tbody"), zones = {}, groups = state.tableGroups && state.tableGroups.length ? state.tableGroups : [{ name: "", rows: state.table }];
    groups.forEach(function (g) {
    if (g.name) { var gr = el("tr", "grp"), gc = el("td", "l grp-name", g.name); gc.colSpan = 12; gr.appendChild(gc); body.appendChild(gr); }
    g.rows.forEach(function (r) {
      var row = el("tr");
      if (m && r.id === m.home.id) row.className = "sel-h"; else if (m && r.id === m.away.id) row.className = "sel-a";
      var pos = el("td", "pos", String(r.rank));
      if (r.note && r.note.color) { pos.style.borderLeftColor = r.note.color; zones[r.note.description] = r.note.color; }
      row.appendChild(pos);
      var tc = el("td", "l team"), inner = el("span", "tc");
      if (r.logo) { var im = new Image(); im.src = r.logo; im.alt = ""; inner.appendChild(im); }
      var tl = el("a", "pl-link", r.name); tl.href = "team.html?l=" + encodeURIComponent(LEAGUES[state.league].slug) + "&id=" + encodeURIComponent(r.id);
      inner.appendChild(tl); tc.appendChild(inner); row.appendChild(tc);
      [r.gp, r.w, r.d, r.l, r.gf, r.ga, (r.gd > 0 ? "+" : "") + r.gd].forEach(function (v) { row.appendChild(el("td", null, String(v))); });
      row.appendChild(el("td", "pts", String(r.pts)));
      row.appendChild(el("td", "wide", r.gp ? (r.gf / r.gp).toFixed(2) : "—"));
      row.appendChild(el("td", "wide", r.gp ? (r.ga / r.gp).toFixed(2) : "—"));
      body.appendChild(row);
    });
    });
    tb.appendChild(body);
    var zb = $("zones"); zb.textContent = "";
    Object.keys(zones).forEach(function (k) { var s = el("span"), i = el("i"); i.style.background = zones[k]; s.appendChild(i); s.appendChild(document.createTextNode(k)); zb.appendChild(s); });
    $("tblNote").textContent = state.tableSeason || "";
  }

  /* ---------- national-team strength ---------- */
  // Goals for and against per game in every international match this year in the player database.
  function loadIntlForm() {
    if (state.intlForm) return Promise.resolve();
    var slugs = Object.keys(LEAGUES).filter(function (k) { return LEAGUES[k].intl; }).map(function (k) { return LEAGUES[k].slug; });
    return Promise.all(slugs.map(function (sl) { return fetch("data/" + sl + "/matches.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }))
      .then(function (files) {
        var rows = {};
        files.forEach(function (f) {
          if (!f) return;
          Object.keys(f.matches).forEach(function (id) {
            var m = f.matches[id];
            [[m.home, m.score[0], m.score[1]], [m.away, m.score[1], m.score[0]]].forEach(function (x) {
              var r = rows[x[0]] = rows[x[0]] || { id: x[0], gp: 0, gf: 0, ga: 0 }; r.gp++; r.gf += x[1]; r.ga += x[2];
            });
          });
        });
        state.intlForm = Object.keys(rows).map(function (k) { return rows[k]; });
      });
  }

  /* ---------- season forecast ---------- */
  function loadForecast() {
    var league = state.league, slug = LEAGUES[league].slug;
    if (state.forecastLeague === league && Date.now() - state.forecastAt < TABLE_MS) return Promise.resolve();
    return fetch("data/" + slug + "/forecast.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (f) { if (league !== state.league) return; state.forecast = f; state.forecastLeague = league; state.forecastAt = Date.now(); });
  }
  function pctTxt(p) { return p >= 0.995 ? ">99%" : p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%"; }
  function renderForecast() {
    var card = $("forecastCard"), box = $("forecast"), f = state.forecastLeague === state.league ? state.forecast : null;
    box.textContent = "";
    var tc = LEAGUES[state.league].fixedBracket && state.titleChances;
    if (!f && !tc) { card.hidden = true; return; }
    card.hidden = false;
    var list = f ? f.teams.map(function (t) { return { id: t.id, name: t.name, logo: t.logo, p: t.title }; })
      : Object.keys(tc).map(function (id) { var r = tableRow(id) || {}; return { id: id, name: r.name || id, logo: r.logo, p: tc[id] }; }).sort(function (a, b) { return b.p - a.p; });
    // headline: the favourite and the nearest challengers
    var lead = el("div", "fc-lead"), top = list[0];
    if (top.logo) { var im = new Image(); im.src = top.logo; im.alt = ""; lead.appendChild(im); }
    var txt = el("div");
    txt.appendChild(el("span", "eyebrow", tc ? "Predicted champion" : (state.league === "ucl" ? "Predicted to top the league phase" : "Predicted winner")));
    txt.appendChild(el("b", "fc-name", top.name));
    txt.appendChild(el("span", "fc-rest", pctTxt(top.p) + " · then " + list.slice(1, 3).map(function (t) { return t.name + " " + pctTxt(t.p); }).join(", ")));
    lead.appendChild(txt); box.appendChild(lead);
    if (tc) { $("fcNote").textContent = "From the playoff bracket"; box.appendChild(el("p", "note", "Title chances for every playoff team are in the bracket below.")); return; }
    $("fcNote").textContent = f.sims.toLocaleString() + " simulations of the " + f.remaining + " fixtures left";
    var wrap = el("div", "tbl-wrap"), t = el("table", "fc-table"), hr = el("tr");
    function span(r) { return r.length > 1 ? ord(r[0]) + "–" + ord(r[r.length - 1]) : ord(r[0]); }
    [["Club", "l"], ["Pts", ""], ["Proj. pts", ""], [state.league === "ucl" ? "Top spot" : "Title", ""]].concat(f.zones.map(function (z) { return [z.name + " (" + span(z.ranks) + ")", ""]; }))
      .forEach(function (h) { hr.appendChild(el("th", h[1], h[0])); });
    var thead = el("thead"); thead.appendChild(hr); t.appendChild(thead);
    var tb = el("tbody");
    f.teams.slice().sort(function (a, b) { return b.proj - a.proj; }).forEach(function (r) {
      var tr = el("tr"), tc0 = el("td", "l"), inner = el("span", "tc");
      if (r.logo) { var im2 = new Image(); im2.src = r.logo; im2.alt = ""; im2.loading = "lazy"; inner.appendChild(im2); }
      inner.appendChild(el("span", null, r.name)); tc0.appendChild(inner); tr.appendChild(tc0);
      tr.appendChild(el("td", null, String(r.pts))); tr.appendChild(el("td", null, r.proj.toFixed(0)));
      [r.title].concat(f.zones.map(function (z) { return r.zones[z.name]; })).forEach(function (p, i) {
        var td = el("td", "fc-p"), bar = el("span", "fc-bar"), fill = el("i");
        fill.style.width = (p * 100).toFixed(1) + "%"; if (i > 0 && f.zones[i - 1].color) fill.style.background = f.zones[i - 1].color;
        bar.appendChild(fill); td.appendChild(bar); td.appendChild(el("span", "num", p ? pctTxt(p) : "–")); tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t); box.appendChild(wrap);
    box.appendChild(el("p", "note", "Each team's strength comes from this season's goals scored and conceded, eased toward average this early in the season and with home advantage. Every remaining fixture is played out " + f.sims.toLocaleString() + " times, allowing for uncertainty in how good each team really is. Zones are the positions marked in ESPN's table. Updated " + new Date(f.updated.replace("Z", ":00Z")).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + "."));
  }

  /* ---------- news ---------- */
  function loadNews(force) {
    var league = state.league;
    if (!force && state.newsLeague === league && Date.now() - state.newsAt < TABLE_MS) return Promise.resolve();
    return getJSON(SITE + LEAGUES[league].slug + "/news").then(function (d) {
      if (league !== state.league) return;
      state.news = (d.articles || []).filter(function (a) { return a.headline && a.links && a.links.web && /^https:\/\//.test(a.links.web.href); });
      state.newsLeague = league; state.newsAt = Date.now();
    }).catch(function () { /* news is optional */ });
  }
  function ago(iso) {
    var mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return Math.max(1, mins) + " min ago";
    if (mins < 1440) return Math.round(mins / 60) + " h ago";
    return fmtDay.format(new Date(iso));
  }
  function renderNews() {
    var card = $("newsCard"), box = $("news"), list = state.newsLeague === state.league ? state.news || [] : [];
    card.hidden = !list.length; box.textContent = "";
    list.slice(0, 5).forEach(function (a, i) {
      var link = el("a", "news-item" + (i === 0 ? " lead" : "")); link.href = a.links.web.href; link.target = "_blank"; link.rel = "noopener";
      var img = a.images && a.images[0];
      if (img && /^https:\/\//.test(img.url)) { var im = new Image(); im.src = img.url; im.alt = ""; im.loading = "lazy"; im.className = "news-img"; link.appendChild(im); }
      var body = el("div", "news-body");
      body.appendChild(el("span", "eyebrow", [ago(a.published), a.byline].filter(Boolean).join(" · ")));
      body.appendChild(el("h3", "news-title", a.headline));
      if (a.description) body.appendChild(el("p", "news-desc", a.description));
      link.appendChild(body); box.appendChild(link);
    });
  }

  /* ---------- loading and polling ---------- */
  function setStatus(text, live, err) {
    var s = $("feedStatus"); s.textContent = ""; s.className = "status" + (err ? " err" : "");
    if (live) s.appendChild(el("span", "dot pulse"));
    s.appendChild(document.createTextNode(text));
  }
  function anyLive() { return state.matches.some(function (m) { return m.state === "in"; }); }
  function nextDelay() {
    if (anyLive()) return LIVE_MS;
    var now = Date.now();
    if (state.matches.some(function (m) { return m.state === "pre" && new Date(m.date) - now < 3 * 3600e3 && new Date(m.date) - now > -3600e3; })) return SOON_MS;
    return IDLE_MS;
  }
  function schedule() {
    clearTimeout(state.timer);
    if (document.hidden) return;
    state.timer = setTimeout(function () { refresh(false); }, nextDelay());
  }
  function loadTable(force) {
    var lg = LEAGUES[state.league];
    if (!force && Date.now() - state.tableAt < TABLE_MS && state.tableLeague === state.league) return Promise.resolve();
    return getJSON(CORE + lg.slug + "/standings").then(function (d) {
      var t = parseTable(d); state.table = t.rows; state.tableGroups = t.groups; state.tableSeason = t.season; state.tableAt = Date.now(); state.tableLeague = state.league;
    }).catch(function () { /* the table is optional; probabilities fall back to odds or league averages */ });
  }
  function loadSummary(id) {
    var lg = LEAGUES[state.league];
    return getJSON(SITE + lg.slug + "/summary?event=" + id).then(function (d) {
      var pc = d.pickcenter && d.pickcenter[0];
      state.summary = { raw: d, odds: pc ? parseOdds(pc) : null };
      state.summaryFor = id;
    }).catch(function () { /* keep whatever summary we had */ });
  }
  function refresh(full) {
    var lg = LEAGUES[state.league], league = state.league;
    var url = SITE + lg.slug + "/scoreboard" + (state.date ? "?dates=" + state.date : "");
    state.loading = true;
    if (full) { setStatus("Loading " + lg.name + "…"); renderFixtures(); }
    var wasLive = {}; state.matches.forEach(function (m) { wasLive[m.id] = m.state; });
    return Promise.all([getJSON(url), loadTable(full)]).then(function (res) {
      if (league !== state.league) return;
      var d = res[0];
      state.matches = (d.events || []).map(parseMatch).sort(function (a, b) {
        var rank = { in: 0, pre: 1, post: 2 }; return (rank[a.state] - rank[b.state]) || new Date(a.date) - new Date(b.date);
      });
      var lgInfo = d.leagues && d.leagues[0];
      if (lgInfo && lgInfo.calendarType === "day" && Array.isArray(lgInfo.calendar) && typeof lgInfo.calendar[0] === "string") {
        state.calendar = lgInfo.calendar.map(function (c) { return c.slice(0, 10); });
      }
      if (lgInfo && lgInfo.calendarType === "list" && lgInfo.calendar && lgInfo.calendar[0] && lgInfo.calendar[0].entries) {
        state.phases = lgInfo.calendar[0].entries.map(function (e) { return { label: e.label, start: e.startDate, end: e.endDate }; });
      }
      state.day = d.day && d.day.date ? d.day.date
        : state.date ? state.date.slice(0, 4) + "-" + state.date.slice(4, 6) + "-" + state.date.slice(6, 8)
        : (state.matches[0] ? state.matches[0].date.slice(0, 10) : ymd(new Date()).replace(/(\d{4})(\d\d)(\d\d)/, "$1-$2-$3"));
      if (state.matches.some(function (m) { return wasLive[m.id] === "in" && m.state === "post"; })) loadTable(true);
      if (state.pendingSel && state.matches.some(function (m) { return m.id === state.pendingSel; })) state.sel = state.pendingSel;
      state.pendingSel = null;
      if (state.matches.some(function (m) { return wasLive[m.id] === "in" && m.state === "post"; })) state.bracketAt = 0;
      if (!state.matches.some(function (m) { return m.id === state.sel; })) {
        state.sel = state.matches.length ? (state.matches.find(function (m) { return m.state === "in"; }) || state.matches[0]).id : null;
      }
      var sel = state.matches.find(function (m) { return m.id === state.sel; });
      var needSummary = sel && (state.summaryFor !== sel.id || sel.state === "in" || wasLive[sel.id] !== sel.state);
      return Promise.all([needSummary ? loadSummary(sel.id) : Promise.resolve(), loadBracket(), loadNews(), loadForecast(), LEAGUES[state.league].intl ? loadIntlForm() : null]).then(function () {
        state.loading = false;
        renderAll();
        var live = anyLive();
        setStatus((live ? "Live · " : "") + "Updated " + fmtClock.format(new Date()), live);
      });
    }).catch(function (e) {
      state.loading = false;
      setStatus("Couldn't reach the scores feed (" + e.message + "). Trying again shortly.", false, true);
      renderAll();
    }).then(schedule);
  }
  function renderAll() {
    var intl = !!LEAGUES[state.league].intl;
    $("seasonLabel").textContent = intl ? LEAGUES[state.league].name : (state.tableSeason || LEAGUES[state.league].name);
    $("dateLabel").textContent = state.day ? fmtDay.format(parseDay(state.day)) : "—";
    document.querySelectorAll(".tab").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.league === state.league || (intl && b.dataset.league === "intl"))); });
    $("intlPick").hidden = !intl; $("intlSel").value = state.league;
    renderFixtures(); renderMatch(); renderTable(); renderBracket(); renderForecast(); renderNews();
    if (state.playersFor !== state.league) { state.playersFor = state.league; Players.mount($("players"), LEAGUES[state.league].slug); }
  }

  /* ---------- bracket ---------- */
  var KNOCKOUT = /playoff|final|knockout|round of/i, NOT_KNOCKOUT = /regular season|league phase|group|3rd|third|play-in/i;
  function utcDay(d) { return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, "0") + String(d.getUTCDate()).padStart(2, "0"); }
  // Matches in each knockout phase. Short phases are read day by day; long ones from the whole year's list.
  function loadBracket() {
    var cfg = LEAGUES[state.league], league = state.league;
    var phases = (state.phases || []).filter(function (p) { return KNOCKOUT.test(p.label) && !NOT_KNOCKOUT.test(p.label); });
    if (!phases.length) { state.bracket = null; return Promise.resolve(); }
    if (state.bracketLeague === league && Date.now() - state.bracketAt < (anyLive() ? LIVE_MS * 2 : TABLE_MS)) return Promise.resolve();
    var dayUrls = {}, years = {};
    phases.forEach(function (p) {
      var s = new Date(p.start), e = new Date(new Date(p.end) - 8 * 3600e3);
      if (s > Date.now()) return; // rounds that haven't started are shown as empty slots until they begin
      var days = Math.round((e - s) / 864e5) + 1;
      if (days <= 10) for (var d = new Date(s); d <= e; d = new Date(+d + 864e5)) dayUrls[utcDay(d)] = 1;
      else { years[s.getUTCFullYear()] = 1; years[e.getUTCFullYear()] = 1; }
    });
    var reqs = Object.keys(dayUrls).map(function (d) { return SITE + cfg.slug + "/scoreboard?dates=" + d; })
      .concat(Object.keys(years).filter(function (y) { return +y <= new Date().getUTCFullYear(); }).map(function (y) { return SITE + cfg.slug + "/scoreboard?dates=" + y + "&limit=400"; }));
    var failed = 0;
    return Promise.all(reqs.map(function (u) { return getJSON(u).catch(function () { failed++; return { events: [] }; }); })).then(function (res) {
      if (league !== state.league) return;
      state.bracketFailed = failed > 0;
      var seen = {}, all = [];
      res.forEach(function (r) { (r.events || []).forEach(function (ev) { if (!seen[ev.id]) { seen[ev.id] = 1; all.push(parseMatch(ev)); } }); });
      // ESPN tags each match with its round ("quarterfinals", "playoffs---semifinals"); phase dates can overlap
      function slugify(t) { return String(t).toLowerCase().replace(/[^a-z0-9]/g, "-"); }
      var tagged = all.some(function (m) { return m.round; });
      state.bracket = phases.map(function (p) {
        var s = new Date(p.start), e = new Date(p.end), want = slugify(p.label);
        return { label: p.label, start: p.start, matches: all.filter(function (m) {
          if (tagged) return m.round === want;
          var t = new Date(m.date); return t >= s && t < e;
        }) };
      });
      state.bracketLeague = league; state.bracketAt = Date.now();
    });
  }
  function bracketApi() {
    var cfg = LEAGUES[state.league];
    return {
      fixedBracket: !!cfg.fixedBracket,
      onTitleChances: function (tc) { state.titleChances = tc; },
      seed: function (id) { var r = tableRow(id); return r ? r.rank : null; },
      team: function (id) {
        var r = tableRow(id); if (r) return r;
        var found = null; (state.bracket || []).forEach(function (p) { p.matches.forEach(function (m) { if (m.home.id === id) found = m.home; if (m.away.id === id) found = m.away; }); });
        return found;
      },
      fmtTime: function (d) { return fmtTime.format(new Date(d)); },
      matchOutcome: function (h, a, neutral) {
        var m = null; (state.bracket || []).forEach(function (p) { p.matches.forEach(function (x) { if (x.home.id === h && x.away.id === a && x.state === "pre") m = x; }); });
        if (m) { var b = baseRates(m); return Model.outcome(b.lh, b.la, 0, 0); }
        var f = Model.formLambdas(state.table, h, a, neutral);
        return f ? Model.outcome(f.lh, f.la, 0, 0) : null;
      },
      openMatch: function (m) {
        if (state.matches.some(function (x) { return x.id === m.id; })) { select(m.id, true); return; }
        state.date = utcDay(new Date(new Date(m.date) - 5 * 3600e3)); state.pendingSel = m.id;
        refresh(true).then(function () { $("matchup").scrollIntoView({ block: "start" }); });
      }
    };
  }
  function renderBracket() {
    var card = $("bracketCard"), box = $("bracket"), cfg = LEAGUES[state.league];
    box.textContent = "";
    var phases = state.bracket;
    if (!phases || (!phases.some(function (p) { return p.matches.length; }) && !cfg.projection)) { card.hidden = true; return; }
    card.hidden = false;
    // live scores from the scoreboard win over the bracket's copy
    var live = {}; state.matches.forEach(function (m) { live[m.id] = m; });
    phases = phases.map(function (p) { return { label: p.label, matches: p.matches.map(function (m) { return live[m.id] || m; }) }; });
    if (phases.some(function (p) { return p.matches.length; })) {
      $("bkNote").textContent = "Click a tie to open it";
      Bracket.renderKnockout(box, phases, bracketApi());
    } else if (state.bracketFailed) {
      $("bkNote").textContent = "";
      box.appendChild(el("p", "note", "Couldn't load the knockout matches. Trying again shortly."));
      state.bracketAt = 0;
    } else {
      var first = state.phases && state.phases.find(function (p) { return KNOCKOUT.test(p.label) && !NOT_KNOCKOUT.test(p.label); });
      var started = first && new Date(first.start) <= Date.now();
      $("bkNote").textContent = "Projected from the current table" + (first && !started ? " · knockouts start " + fmtDay.format(new Date(first.start)) : "");
      if (state.table.length) Bracket.renderProjection(box, state.table, cfg.projection);
    }
  }
  function select(id, scroll) {
    state.sel = id; renderFixtures(); renderMatch(); renderTable();
    var m = state.matches.find(function (x) { return x.id === id; });
    if (m && m.state !== "pre" || state.summaryFor !== id) loadSummary(id).then(function () { if (state.sel === id) { renderMatch(); renderFixtures(); } });
    if (scroll) $("matchup").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  function setLeague(lg) {
    if (!LEAGUES[lg]) lg = "wsl";
    state.league = lg; state.date = null; state.calendar = null; state.phases = null; state.bracket = null; state.bracketAt = 0; state.titleChances = null; state.forecast = null; state.matches = []; state.table = []; state.tableGroups = []; state.tableAt = 0; state.sel = null; state.summary = null; state.summaryFor = null;
    store("wmh-league", lg);
    if (LEAGUES[lg].intl) store("wmh-intl", lg);
    if (location.hash !== "#" + lg) history.replaceState(null, "", "#" + lg);
    refresh(true);
  }
  // With a fixture calendar (WSL, Liga F) jump to the previous or next matchday; otherwise move one day.
  function shiftDay(n) {
    var cur = state.day ? String(state.day).slice(0, 10) : null, target = null;
    if (state.calendar && state.calendar.length && cur) {
      var c = state.calendar;
      target = n > 0 ? c.find(function (x) { return x > cur; }) : c.slice().reverse().find(function (x) { return x < cur; });
      if (!target) return;
      state.date = target.replace(/-/g, "");
      state.sel = null; refresh(true);
      return;
    }
    // No fixture calendar (NWSL, Champions League): look ahead a week at a time, up to six weeks, for the next day with matches.
    var start = cur ? parseDay(cur) : new Date(), lg = state.league;
    setStatus("Looking for the " + (n > 0 ? "next" : "previous") + " matchday…");
    (function batch(k) {
      if (k >= 6) { setStatus("No matches in the six weeks " + (n > 0 ? "after" : "before") + " this day."); return; }
      var days = [];
      for (var i = 1; i <= 7; i++) { var d = new Date(start); d.setDate(d.getDate() + n * (k * 7 + i)); days.push(ymd(d)); }
      Promise.all(days.map(function (d) { return getJSON(SITE + LEAGUES[lg].slug + "/scoreboard?dates=" + d).catch(function () { return {}; }); })).then(function (res) {
        if (lg !== state.league) return;
        var hit = res.findIndex(function (r) { return r.events && r.events.length; });
        if (hit < 0) return batch(k + 1);
        state.date = days[hit]; state.sel = null; refresh(true);
      });
    })(0);
  }

  /* ---------- events ---------- */
  var uploadFor = null;
  document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () {
    setLeague(b.dataset.league === "intl" ? (LEAGUES[store("wmh-intl")] ? store("wmh-intl") : "friendlies") : b.dataset.league);
  }); });
  Object.keys(LEAGUES).filter(function (k) { return LEAGUES[k].intl; }).forEach(function (k) { $("intlSel").appendChild(new Option(LEAGUES[k].name, k)); });
  $("intlSel").addEventListener("change", function (e) { setLeague(e.target.value); });
  $("prevDay").addEventListener("click", function () { shiftDay(-1); });
  $("nextDay").addEventListener("click", function () { shiftDay(1); });
  $("todayBtn").addEventListener("click", function () { state.date = null; state.sel = null; refresh(true); });
  $("fileIn").addEventListener("change", function (e) {
    var f = e.target.files && e.target.files[0]; if (!f || !uploadFor) return;
    Photos.upload(uploadFor, f, function (saved) {
      renderMatch();
      if (!saved) setStatus("Photo too large to keep after you leave; it shows for this visit only.", false, true);
    });
  });
  document.addEventListener("visibilitychange", function () { if (document.hidden) clearTimeout(state.timer); else refresh(false); });
  window.addEventListener("hashchange", function () { var lg = location.hash.slice(1); if (LEAGUES[lg] && lg !== state.league) setLeague(lg); });
  var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { var m = state.matches.find(function (x) { return x.id === state.sel; }); if (m) renderFlow(m, probs(m)); }, 150); });

  // all kick-off times use the viewer's own time zone; say which one
  (function () {
    var zone = "", abbr = "";
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    try { abbr = (new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date()).find(function (x) { return x.type === "timeZoneName"; }) || {}).value || ""; } catch (e) {}
    $("tzNote").textContent = "Times in your time zone" + (zone || abbr ? ": " + [zone.replace(/_/g, " "), abbr].filter(Boolean).join(", ") : "");
  })();
  setLeague(LEAGUES[location.hash.slice(1)] ? location.hash.slice(1) : (store("wmh-league") || "wsl"));
  Photos.loadShared().then(function () { renderFixtures(); renderMatch(); });
})();
