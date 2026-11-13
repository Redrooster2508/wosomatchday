/* One page per team, club or country, whichever competition it was opened from: photo, record, forecasts, results and
   fixtures from every competition, squad and heatmaps added up across competitions, and head to head.
   Address: team.html?id=<ESPN team id>, optionally &l=<league slug> (the competition it was opened from, for the back link) */
(function () {
  "use strict";
  // [name, home page tab, short label for results and fixtures, international, men's]
  var NAMES = { "eng.w.1": ["Women's Super League", "wsl", "WSL"], "esp.w.1": ["Liga F", "ligaf", "Liga F"], "usa.nwsl": ["NWSL", "nwsl", "NWSL"],
    "uefa.wchampions": ["Women's Champions League", "ucl", "Champions League"],
    "fifa.friendly.w": ["International friendlies", "friendlies", "Friendly", 1], "fifa.wwcq.ply": ["World Cup qualifying play-offs", "wcq", "World Cup play-off", 1],
    "concacaf.womens.championship": ["Concacaf W Championship", "wchamp", "W Championship", 1], "caf.w.nations": ["Women's Africa Cup of Nations", "wafcon", "WAFCON", 1],
    "afc.w.asian.cup": ["AFC Women's Asian Cup", "asian", "Asian Cup", 1], "fifa.wwc": ["FIFA Women's World Cup", "wwc", "World Cup", 1], "uefa.weuro": ["UEFA Women's Euro", "weuro", "Euro", 1],
    "conmebol.america.femenina": ["Copa América Femenina", "copa", "Copa América", 1], "fifa.w.olympics": ["Olympic tournament", "olympics", "Olympics", 1],
    "uefa.w.nations": ["UEFA Women's Nations League", "wnl", "Nations League", 1],
    // men's national teams and clubs have a player database but no home page tab
    "fifa.friendly": ["Men's international friendlies", null, "Friendly", 1, 1], "fifa.world": ["FIFA World Cup", null, "World Cup", 1, 1],
    "uefa.nations": ["UEFA Nations League", null, "Nations League", 1, 1], "concacaf.nations.league": ["Concacaf Nations League", null, "Nations League", 1, 1],
    "caf.nations_qual": ["Africa Cup of Nations qualifying", null, "AFCON qualifier", 1, 1], "caf.nations": ["Africa Cup of Nations", null, "AFCON", 1, 1],
    "fifa.worldq.uefa": ["World Cup qualifying, Europe", null, "World Cup qualifier", 1, 1], "fifa.worldq.conmebol": ["World Cup qualifying, South America", null, "World Cup qualifier", 1, 1],
    "fifa.worldq.afc": ["World Cup qualifying, Asia", null, "World Cup qualifier", 1, 1], "fifa.worldq.caf": ["World Cup qualifying, Africa", null, "World Cup qualifier", 1, 1],
    "fifa.worldq.concacaf": ["World Cup qualifying, Concacaf", null, "World Cup qualifier", 1, 1],
    // men's clubs, reached from their players' pages
    "eng.1": ["Premier League", null, "Premier League", 0, 1], "esp.1": ["LaLiga", null, "LaLiga", 0, 1], "uefa.champions": ["UEFA Champions League", null, "Champions League", 0, 1] };
  var DOMESTIC = ["eng.w.1", "esp.w.1", "usa.nwsl", "eng.1", "esp.1"];   // a club's main competition: its record and back link
  var SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/", CORE = "https://site.api.espn.com/apis/v2/sports/soccer/";
  var qs = new URLSearchParams(location.search), slug = qs.get("l"), id = qs.get("id");
  function $(x) { return document.getElementById(x); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
  function opt(u) { return getJSON(u).catch(function () { return null; }); }
  function ord(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function pct(p) { return p >= 0.995 ? ">99%" : p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%"; }
  function and(xs) { return xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]; }
  var tip = $("tip");
  function showTip(e, t) { tip.textContent = t; tip.hidden = false; var x = e.clientX + 14, y = e.clientY + 14; if (x + tip.offsetWidth > innerWidth - 8) x = e.clientX - tip.offsetWidth - 14; if (y + tip.offsetHeight > innerHeight - 8) y = e.clientY - tip.offsetHeight - 14; tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px"; }
  function tipFn(e, t) { if (e) showTip(e, t); else tip.hidden = true; }
  function logo(src, cls) { if (!src) return el("span", "crest-none", ""); var im = new Image(); im.src = src; im.alt = ""; im.loading = "lazy"; if (cls) im.className = cls; return im; }

  if (!/^\d+$/.test(id || "") || (slug && !/^[a-z0-9._]+$/.test(slug))) { $("tName").textContent = "Team not found"; return; }
  // competitions outside NAMES (Champions League qualifying, men's Nations League, men's friendlies…) take ESPN's own name
  var LG = {};
  function lgName(lg) { return lg.shortName || lg.abbreviation || lg.name || ""; }
  function label(c) {
    if (NAMES[c]) return NAMES[c][2];
    var lg = LG[c] || {}, base = c.replace(/_qual$/, "");
    if (base !== c && NAMES[base]) return NAMES[base][2] + " qualifier";
    if (/worldq|wwcq/.test(c)) return "World Cup qualifier";
    if (/euroq/.test(c)) return "Euro qualifier";
    if (/friendly/i.test(lg.name || "")) return "Friendly";
    return (lgName(lg) || c).replace(/^(UEFA|FIFA|Concacaf|CONMEBOL|CAF|AFC|OFC) /i, "");   // the team's confederation is no news on its own page
  }
  function fullName(c) { return NAMES[c] ? NAMES[c][0] : lgName(LG[c] || {}) || c; }
  function mine(e) { return e.competitions && e.competitions[0].competitors.some(function (x) { return String(x.team.id) === id; }); }

  // ESPN's all-competition schedule names the team's competitions (it keeps men's and women's teams apart, but can come back
  // empty), then each competition the site covers is asked for its own schedule and data.
  // Team schedules return results by default and upcoming matches only with fixture=true.
  Promise.all([opt(SITE + "all/teams/" + id + "/schedule?fixture=true"), opt(SITE + "all/teams/" + id + "/schedule"), Photos.loadShared()]).then(function (r0) {
    var allEvs = [], comps = [];
    function addComp(c) { if (c && comps.indexOf(c) < 0) comps.push(c); }
    r0.slice(0, 2).forEach(function (d) { (d && d.events || []).forEach(function (e) { if (!e.league || !mine(e)) return; allEvs.push(e); addComp(e.league.slug); if (!LG[e.league.slug]) LG[e.league.slug] = e.league; }); });
    if (!comps.length) addComp(slug);   // the competition it was opened from counts only when ESPN lists nothing current
    var known = comps.filter(function (c) { return NAMES[c]; }), fetched = known.concat(slug && !NAMES[slug] && comps.indexOf(slug) >= 0 ? [slug] : []);
    return Promise.all(fetched.map(function (c) {
      var k = !!NAMES[c];
      return Promise.all([opt(SITE + c + "/teams/" + id + "/schedule"), opt(SITE + c + "/teams/" + id + "/schedule?fixture=true"),
        k ? opt(CORE + c + "/standings") : null, k ? opt("data/" + c + "/players.json") : null, k ? opt("data/" + c + "/heat.json") : null,
        k ? opt("data/" + c + "/minutes.json") : null, k ? opt("data/" + c + "/forecast.json") : null, k || LG[c] ? null : opt(SITE + c + "/scoreboard")]);
    })).then(function (rs) { render(allEvs, comps, known, fetched, rs, r0); });
  });

  function render(allEvs, comps, known, fetched, rs, r0) {
    // every match once, tagged with its competition
    var byId = {}, evList = [], D = {}, team = {};
    allEvs.forEach(function (e) { if (!byId[e.id]) { byId[e.id] = e.league.slug; evList.push(e); } });
    fetched.forEach(function (c, i) {
      var x = rs[i];
      D[c] = { st: x[2], P: x[3], H: x[4], MIN: x[5] || {}, F: x[6] };
      if (x[7] && x[7].leagues && x[7].leagues[0]) LG[c] = x[7].leagues[0];
      [x[0], x[1]].forEach(function (d) { if (!d) return; if (d.team && !team.displayName) team = d.team; (d.events || []).forEach(function (e) { if (!byId[e.id] && mine(e)) { byId[e.id] = c; evList.push(e); } }); });
    });
    if (!team.displayName) [r0[0], r0[1]].forEach(function (d) { if (d && d.team && !team.displayName) team = d.team; });
    // the competitions the team is playing in now, its main one first
    var active = comps.filter(function (c) { return evList.some(function (e) { return byId[e.id] === c; }); });
    if (!active.length) active = comps.slice();
    var main = DOMESTIC.filter(function (c) { return active.indexOf(c) >= 0; })[0] || (NAMES[slug] && active.indexOf(slug) >= 0 ? slug : null) || active.filter(function (c) { return NAMES[c]; })[0] || active[0];
    active.sort(function (a, b) { return (b === main) - (a === main) || !!NAMES[b] - !!NAMES[a]; });
    var ours = active.filter(function (c) { return NAMES[c] && D[c]; });   // the site's competitions, with a player database
    var intl = ours.some(function (c) { return NAMES[c][3]; }) || !!team.isNational;
    var labelled = intl || active.length > 1;
    var back = slug && NAMES[slug] && NAMES[slug][1] ? slug : NAMES[main] && NAMES[main][1] ? main : null;
    $("back").href = back ? "./#" + NAMES[back][1] : "./";

    // team details: schedule first, then standings, then the player database
    var rows = {}, rowOf = {};
    ours.forEach(function (c) {
      rows[c] = [];
      ((D[c].st && D[c].st.children) || []).forEach(function (g) { (g.standings && g.standings.entries || []).forEach(function (e) { rows[c].push(e); if (String(e.team.id) === id) rowOf[c] = e; }); });
    });
    var pt = null; ours.some(function (c) { return (pt = D[c].P && D[c].P.teams[id]); });
    var row = rowOf[main];
    var name = (team.displayName || (row && row.team.displayName) || (pt && pt.name) || "Team").trim();
    var crest = team.logo || (team.logos && team.logos[0] && team.logos[0].href) || (row && row.team.logos && row.team.logos[0] && row.team.logos[0].href) || (pt && pt.logo) || "";
    var color = team.color || (pt && pt.color) || "334455", alt = team.alternateColor || "ffffff";
    var lname = ours.length ? ours.map(fullName).join(" · ") : active.map(label).join(" · ");
    document.title = name + " · Matchday Hub";
    $("tName").textContent = name;
    $("tLeague").textContent = fullName(main);
    var cr = $("tCrest"); cr.appendChild(logo(crest)); cr.appendChild(el("span", null, lname));
    // each competition keeps one colour across labels, results, fixtures and head to head; the main one first
    function kc(c) { var i = active.indexOf(c); return "k" + (i < 0 ? 3 : Math.min(i, 3)); }
    // a men's team (reached from a national team's fixtures) has its crest on its colours instead of a team photo: the
    // illustrations draw women and photos are keyed by women's team ids. Men's teams outside the database have no squad.
    var men = ours.length ? ours.every(function (c) { return NAMES[c][4]; }) : !/women|femen|\.w(\.|_|$)/i.test(active.join(" ") + " " + lname);
    if (men) {
      var bp = $("tPhoto"); bp.classList.add("tp-badge"); bp.style.setProperty("--c1", "#" + color); bp.style.setProperty("--c2", "#" + alt);
      if (crest) bp.appendChild(logo(crest, "tp-badge-crest"));
      if (!ours.length) { $("tSquad").parentNode.hidden = true; $("tHeat").parentNode.hidden = true; }
    }
    else {
      // photo: shared or illustrated
      var tObj = { id: id, color: color, alternateColor: alt };
      var ph = $("tPhoto"), im = new Image(); im.className = "ph-img"; im.src = Photos.get(tObj); im.alt = Photos.isPhoto(id) ? name + " team photo" : "Illustrated line-up in " + name + " colours"; ph.appendChild(im); Photos.frame(ph, im, id);
      if (crest) ph.appendChild(logo(crest, "crest"));
      var cd = Photos.credit(id);
      if (cd) { $("tCredit").textContent = "Photo: "; if (cd.source) { var a = el("a", null, cd.text); a.href = cd.source; a.target = "_blank"; a.rel = "noopener"; $("tCredit").appendChild(a); } else $("tCredit").appendChild(document.createTextNode(cd.text)); }
    }
    // record in the main competition, and the position in any other table
    var facts = [];
    if (row) {
      var s = {}; (row.stats || []).forEach(function (x) { s[x.name] = x.value; });
      facts.push(["Position", ord(s.rank)], ["Points", s.points], ["Played", s.gamesPlayed], ["Record", s.wins + "W " + s.ties + "D " + s.losses + "L"], ["Goals", s.pointsFor + "–" + s.pointsAgainst]);
      if (row.note && row.note.description) facts.push(["Zone", row.note.description]);
    }
    ours.forEach(function (c) {
      if (c === main || !rowOf[c] || NAMES[c][3]) return;   // a club's other tables; a national team's old tournament groups mean little
      var rk = (rowOf[c].stats || []).find(function (x) { return x.name === "rank"; });
      if (rk) facts.push([label(c), ord(rk.value)]);
    });
    facts.forEach(function (f) { var d = el("div"); d.appendChild(el("dt", null, f[0])); d.appendChild(el("dd", null, String(f[1]))); $("tFacts").appendChild(d); });

    // results and fixtures from every competition
    var evs = evList.map(function (ev) {
      var cp = ev.competitions[0], me = cp.competitors.find(function (x) { return String(x.team.id) === id; }), op = cp.competitors.find(function (x) { return String(x.team.id) !== id; });
      function sc(x) { var v = x && x.score; return v == null ? null : typeof v === "object" ? (v.displayValue != null ? +v.displayValue : +v.value) : +v; }
      var stt = (cp.status || ev.status || {}).type || {};
      return { id: ev.id, comp: byId[ev.id], date: ev.date, home: me && me.homeAway === "home", opp: op ? (op.team.shortDisplayName || op.team.displayName) : "", oppId: op ? String(op.team.id) : "", oppLogo: op && op.team.logos && op.team.logos[0] && op.team.logos[0].href,
        done: !!stt.completed, gf: sc(me), ga: sc(op), detail: stt.shortDetail || "" };
    });
    var res = evs.filter(function (e) { return e.done; }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var fix = evs.filter(function (e) { return !e.done; }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var form = $("tForm"); res.slice(0, 5).reverse().forEach(function (e) { var k = e.gf > e.ga ? "W" : e.gf < e.ga ? "L" : "D"; form.appendChild(el("span", k, k)); });
    function list(box, items, done) {
      if (!items.length) { box.appendChild(el("p", "note", done ? "No results yet." : "No fixtures scheduled.")); return; }
      var t = el("table", "tp-list"), tb = el("tbody");
      items.slice(0, 10).forEach(function (e) {
        var tr = el("tr", labelled ? kc(e.comp) : null);
        var dt = el("td", "l", new Date(e.date).toLocaleDateString(undefined, { weekday: done ? undefined : "short", day: "numeric", month: "short" }) + (done ? "" : " " + new Date(e.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })));
        if (labelled) { var lc = el("div", "fx-comp"); lc.appendChild(el("span", "chip " + kc(e.comp), label(e.comp))); dt.appendChild(lc); }
        tr.appendChild(dt);
        var o = el("td", "l opp"), oi = el("span", "tc"); oi.appendChild(logo(e.oppLogo));
        var link = el("a", "pl-link", (e.home ? "v " : "at ") + e.opp); link.href = "team.html?l=" + encodeURIComponent(e.comp) + "&id=" + encodeURIComponent(e.oppId); oi.appendChild(link); o.appendChild(oi); tr.appendChild(o);
        if (done) { var k = e.gf > e.ga ? "W" : e.gf < e.ga ? "L" : "D"; var td = el("td"); td.appendChild(el("span", "res " + k, k + " " + e.gf + "–" + e.ga)); tr.appendChild(td); }
        tb.appendChild(tr);
      });
      t.appendChild(tb); box.appendChild(t);
    }
    list($("tResults"), res, true); list($("tFixtures"), fix, false);
    if (labelled) ["rsH", "fxH2"].forEach(function (h) { $(h).parentNode.appendChild(el("span", "eyebrow", "All competitions")); });

    // forecasts, one block per competition that has one
    var fcs = ours.map(function (c) { var F = D[c].F, ft = F && F.teams.find(function (t) { return t.id === id; }); return ft && { c: c, F: F, ft: ft }; }).filter(Boolean);
    if (fcs.length) {
      $("tForecastCard").hidden = false;
      $("tfNote").textContent = fcs[0].F.sims.toLocaleString() + " simulations of the fixtures left" + (fcs.length > 1 ? " in each competition" : "");
      fcs.forEach(function (x) {
        var box = $("tForecast");
        if (fcs.length > 1) { var g = el("div", "fc-group"); g.appendChild(el("h3", null, fullName(x.c))); box = el("div", "pl-tiles pp-tiles"); g.appendChild(box); $("tForecast").parentNode.insertBefore(g, $("tForecast")); }
        [[x.c === "uefa.wchampions" ? "Top spot" : "Title", pct(x.ft.title)], ["Projected points", x.ft.proj.toFixed(0)]].concat(x.F.zones.map(function (z) { return [z.name, pct(x.ft.zones[z.name])]; }))
          .forEach(function (t) { var d = el("div", "pl-tile"); d.appendChild(el("b", "num", t[1])); d.appendChild(el("span", null, t[0])); box.appendChild(d); });
      });
      if (fcs.length > 1) $("tForecast").hidden = true;
    }

    // squad: every competition's numbers added together; a player's link goes to the competition they've played most in
    var SUM = ["apps", "starts", "cs", "G", "A", "SHOT", "SOG", "SV", "GA", "YC", "RC", "FC", "FA", "OG"], sq = {}, squad = [], squadComps = [];
    ours.forEach(function (c) {
      var P = D[c].P; if (!P) return;
      P.players.forEach(function (p) {
        if (p.team !== id) return;
        if (squadComps.indexOf(c) < 0) squadComps.push(c);
        var m = D[c].MIN[p.id] || {}, q = sq[p.id];
        if (!q) { q = sq[p.id] = { id: p.id, name: p.name, pos: p.pos, no: p.no, min: 0, pp: 0, best: c, bestMin: -1 }; SUM.forEach(function (k) { q[k] = 0; }); squad.push(q); }
        SUM.forEach(function (k) { q[k] += p[k] || 0; });
        q.min += m.m || 0; q.pp += m.pp || 0;
        if ((m.m || 0) > q.bestMin) { q.best = c; q.bestMin = m.m || 0; }
        if (!q.pos) q.pos = p.pos; if (!q.no) q.no = p.no;
      });
    });
    squad.sort(function (a, b) { return (b.min - a.min) || (b.apps - a.apps); });
    var sqTip = "click a player for " + (men ? "his" : "her") + " page";
    $("sqH").parentNode.querySelector(".eyebrow").textContent = squadComps.length > 1 ? and(squadComps.map(label)) + " · " + sqTip : sqTip.charAt(0).toUpperCase() + sqTip.slice(1);
    if (!squad.length) $("tSquad").appendChild(el("p", "note", "No players in the database for this team yet."));
    else {
      var t = el("table", "tp-squad"), hr = el("tr");
      [["Player", "l"], ["Pos", "l"], ["Apps", ""], ["Min", ""], ["Goals", ""], ["Assists", ""], ["Goals/90", ""], ["Shots", ""], ["Prog. passes", ""], ["Cards", ""]].forEach(function (h) { hr.appendChild(el("th", h[1], h[0])); });
      var thead = el("thead"); thead.appendChild(hr); t.appendChild(thead);
      var tb = el("tbody");
      squad.forEach(function (p) {
        var tr = el("tr", "pl-row"), href = "player.html?l=" + encodeURIComponent(p.best) + "&id=" + encodeURIComponent(p.id);
        var n = el("td", "l pl-name"), a = el("a", "pl-link", p.name); a.href = href; n.appendChild(a); if (p.no) n.appendChild(el("span", "pl-pos-tag", "#" + p.no)); tr.appendChild(n);
        tr.appendChild(el("td", "l", p.pos || ""));
        [p.apps, p.min || "—", p.G, p.A, p.min >= 270 ? (p.G / p.min * 90).toFixed(2) : "–", p.SHOT, p.pp, p.YC + p.RC].forEach(function (v) { tr.appendChild(el("td", null, String(v))); });
        tr.addEventListener("click", function (e) { if (!e.target.closest("a")) location.href = href; });
        tb.appendChild(tr);
      });
      t.appendChild(tb); $("tSquad").appendChild(t);
    }

    // team heatmaps: every squad player's season data in every competition added together
    var withHeat = [], noPos = [], unbuilt = [], agg = { n: 0, c: {}, s: [], p: 0, pp: 0, pl: [] }, grid = null;
    squadComps.forEach(function (c) {
      var H = D[c].H;
      if (!H) { unbuilt.push(c); return; }
      if (!Object.keys(H.players || {}).length) { noPos.push(c); return; }
      withHeat.push(c); grid = grid || H.grid;
      squad.forEach(function (p) {
        var e = H.players[p.id]; if (!e) return;
        agg.n += e.n; agg.p += e.p || 0; agg.pp += e.pp || 0;
        Object.keys(e.c).forEach(function (k) { agg.c[k] = (agg.c[k] || 0) + e.c[k]; });
        (e.s || []).forEach(function (q) { agg.s.push(q.slice(0, 3).concat([p.name + (q[3] ? " v " + q[3] : ""), q[4], q[5], q[6]])); });
        agg.pl = agg.pl.concat(e.pl || []);
      });
    });
    var missing = (noPos.length ? "ESPN's play-by-play for " + and(noPos.map(label)) + " has no pitch positions" : "") +
      (noPos.length && unbuilt.length ? "; " : "") + (unbuilt.length ? "heatmaps for " + and(unbuilt.map(label)) + " haven't been built yet" : "");
    if (!withHeat.length) $("tHeat").appendChild(el("p", "note", missing ? missing.charAt(0).toUpperCase() + missing.slice(1) + "." : "Heatmaps for this team haven't been built yet."));
    else {
      agg.pl = agg.pl.filter(function (q) { return q[2] < 99 && q[0] < 99; }).slice(-120);
      Heat.seasonPanel($("tHeat"), agg, grid, tipFn);
      if (squadComps.length > 1) $("tHeat").appendChild(el("p", "note", "From " + and(withHeat.map(label)) + " matches" + (missing ? ". " + missing.charAt(0).toUpperCase() + missing.slice(1) : "") + "."));
    }

    // head to head in any of the team's competitions
    var h2hComps = ours.length ? ours : active;
    var opps = [];
    function addOpp(oid, oname) { if (oid && oid !== id && !opps.some(function (o) { return o.id === oid; })) opps.push({ id: oid, name: oname }); }
    h2hComps.forEach(function (c) { (rows[c] || []).forEach(function (e) { addOpp(String(e.team.id), (e.team.shortDisplayName || e.team.displayName || "").trim()); }); });
    res.concat(fix).forEach(function (e) { if (h2hComps.indexOf(e.comp) >= 0) addOpp(e.oppId, e.opp); });
    opps.sort(function (a, b) { return a.name.localeCompare(b.name); });
    $("h2hH").parentNode.querySelector(".eyebrow").textContent = (h2hComps.length > 1 ? "Meetings in " + and(h2hComps.map(label)) : "League meetings") + ", last five seasons";
    var sel = $("h2hSel"); opps.forEach(function (o) { sel.appendChild(new Option(o.name, o.id)); });
    var nx = fix.find(function (e) { return h2hComps.indexOf(e.comp) >= 0; }); if (nx) sel.value = nx.oppId;
    function showH2H() {
      var o = opps.find(function (x) { return x.id === sel.value; }); if (!o) return;
      $("tH2H").textContent = ""; $("tH2H").appendChild(el("p", "note", "Loading meetings…"));
      Promise.all(h2hComps.map(function (c) { return H2H.load(c, id, o.id); })).then(function (lists) {
        var seen = {}, ms = [];
        lists.forEach(function (l, i) { l.forEach(function (m) { if (!seen[m.id]) { seen[m.id] = 1; if (h2hComps.length > 1) { m.label = label(h2hComps[i]); m.cls = kc(h2hComps[i]); } ms.push(m); } }); });
        ms.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
        if (sel.value === o.id) H2H.render($("tH2H"), ms, id, name, o.name);
      });
    }
    sel.addEventListener("change", showH2H);
    if (opps.length) showH2H(); else $("tH2H").appendChild(el("p", "note", "No opponents listed."));
  }
})();
