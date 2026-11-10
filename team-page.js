/* One team's page: photo, record, forecast, results and fixtures, squad, season heatmaps and head to head.
   Address: team.html?l=<league slug>&id=<ESPN team id> */
(function () {
  "use strict";
  // [name, home page tab, fixture label for international competitions]
  var NAMES = { "eng.w.1": ["Women's Super League", "wsl"], "esp.w.1": ["Liga F", "ligaf"], "usa.nwsl": ["NWSL", "nwsl"], "uefa.wchampions": ["Women's Champions League", "ucl"],
    "fifa.friendly.w": ["International friendlies", "friendlies", "Friendly"], "fifa.wwcq.ply": ["World Cup qualifying play-offs", "wcq", "World Cup play-off"],
    "concacaf.womens.championship": ["Concacaf W Championship", "wchamp", "W Championship"], "caf.w.nations": ["Women's Africa Cup of Nations", "wafcon", "WAFCON"],
    "afc.w.asian.cup": ["AFC Women's Asian Cup", "asian", "Asian Cup"], "fifa.wwc": ["FIFA Women's World Cup", "wwc", "World Cup"], "uefa.weuro": ["UEFA Women's Euro", "weuro", "Euro"],
    "conmebol.america.femenina": ["Copa América Femenina", "copa", "Copa América"], "fifa.w.olympics": ["Olympic tournament", "olympics", "Olympics"],
    "uefa.w.nations": ["UEFA Women's Nations League", "wnl", "Nations League"] };
  var SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/", CORE = "https://site.api.espn.com/apis/v2/sports/soccer/";
  var qs = new URLSearchParams(location.search), slug = qs.get("l"), id = qs.get("id");
  function $(x) { return document.getElementById(x); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
  function opt(u) { return getJSON(u).catch(function () { return null; }); }
  function ord(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function pct(p) { return p >= 0.995 ? ">99%" : p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%"; }
  var tip = $("tip");
  function showTip(e, t) { tip.textContent = t; tip.hidden = false; var x = e.clientX + 14, y = e.clientY + 14; if (x + tip.offsetWidth > innerWidth - 8) x = e.clientX - tip.offsetWidth - 14; if (y + tip.offsetHeight > innerHeight - 8) y = e.clientY - tip.offsetHeight - 14; tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px"; }
  function tipFn(e, t) { if (e) showTip(e, t); else tip.hidden = true; }
  function logo(src, cls) { if (!src) return el("span", "crest-none", ""); var im = new Image(); im.src = src; im.alt = ""; im.loading = "lazy"; if (cls) im.className = cls; return im; }

  if (!slug || !NAMES[slug] || !/^\d+$/.test(id || "")) { $("tName").textContent = "Team not found"; return; }
  $("tLeague").textContent = NAMES[slug][0];
  $("back").href = "./#" + NAMES[slug][1];
  // a national team's fixtures come from every international competition, each labelled with its competition
  var intl = !!NAMES[slug][2], others = intl ? Object.keys(NAMES).filter(function (s) { return NAMES[s][2] && s !== slug; }) : [];

  // ESPN's team schedule returns results by default and upcoming matches only with fixture=true
  Promise.all([opt(CORE + slug + "/standings"), opt(SITE + slug + "/teams/" + id + "/schedule"), opt("data/" + slug + "/players.json"), opt("data/" + slug + "/heat.json"),
               opt("data/" + slug + "/minutes.json"), opt("data/" + slug + "/forecast.json"), Photos.loadShared(), opt(SITE + slug + "/teams/" + id + "/schedule?fixture=true"),
               Promise.all(others.map(function (s) { return opt(SITE + s + "/teams/" + id + "/schedule?fixture=true"); }))]).then(function (r) {
    var st = r[0], sch = r[1], P = r[2], H = r[3], MIN = r[4] || {}, F = r[5], fx = r[7], comp = {};
    if (sch && fx && fx.events) { var have = {}; (sch.events || []).forEach(function (e) { have[e.id] = 1; }); sch.events = (sch.events || []).concat(fx.events.filter(function (e) { return !have[e.id]; })); }
    else if (!sch && fx) sch = fx;
    if (sch) (sch.events || []).forEach(function (e) { comp[e.id] = slug; });
    r[8].forEach(function (d, i) {
      var more = (d && d.events || []).filter(function (e) { return !comp[e.id]; });
      more.forEach(function (e) { comp[e.id] = others[i]; });
      if (more.length) { if (!sch) sch = d; else sch.events = (sch.events || []).concat(more); }
    });
    // team details: schedule first, then standings, then the player database
    var team = (sch && sch.team) || {}, row = null, rows = [];
    ((st && st.children) || []).forEach(function (g) { (g.standings && g.standings.entries || []).forEach(function (e) { rows.push(e); if (String(e.team.id) === id) row = e; }); });
    var name = (team.displayName || (row && row.team.displayName) || (P && P.teams[id] && P.teams[id].name) || "Team").trim();
    var crest = (team.logo) || (team.logos && team.logos[0] && team.logos[0].href) || (row && row.team.logos && row.team.logos[0] && row.team.logos[0].href) || (P && P.teams[id] && P.teams[id].logo) || "";
    var color = team.color || (P && P.teams[id] && P.teams[id].color) || "334455", alt = team.alternateColor || "ffffff";
    document.title = name + " · Matchday Hub";
    $("tName").textContent = name;
    var cr = $("tCrest"); cr.appendChild(logo(crest)); cr.appendChild(el("span", null, NAMES[slug][0]));
    // photo: shared or illustrated
    var tObj = { id: id, color: color, alternateColor: alt };
    var ph = $("tPhoto"), im = new Image(); im.className = "ph-img"; im.src = Photos.get(tObj); im.alt = Photos.isPhoto(id) ? name + " team photo" : "Illustrated line-up in " + name + " colours"; ph.appendChild(im); Photos.frame(ph, im, id);
    if (crest) ph.appendChild(logo(crest, "crest"));
    var c = Photos.credit(id);
    if (c) { $("tCredit").textContent = "Photo: "; if (c.source) { var a = el("a", null, c.text); a.href = c.source; a.target = "_blank"; a.rel = "noopener"; $("tCredit").appendChild(a); } else $("tCredit").appendChild(document.createTextNode(c.text)); }
    // record
    if (row) {
      var s = {}; (row.stats || []).forEach(function (x) { s[x.name] = x.value; });
      var facts = [["Position", ord(s.rank)], ["Points", s.points], ["Played", s.gamesPlayed], ["Record", s.wins + "W " + s.ties + "D " + s.losses + "L"], ["Goals", s.pointsFor + "–" + s.pointsAgainst]];
      if (row.note && row.note.description) facts.push(["Zone", row.note.description]);
      facts.forEach(function (f) { var d = el("div"); d.appendChild(el("dt", null, f[0])); d.appendChild(el("dd", null, String(f[1]))); $("tFacts").appendChild(d); });
    }
    // results and fixtures from the schedule
    var evs = (sch && sch.events || []).map(function (ev) {
      var cp = ev.competitions[0], me = cp.competitors.find(function (x) { return String(x.team.id) === id; }), op = cp.competitors.find(function (x) { return String(x.team.id) !== id; });
      function sc(x) { var v = x && x.score; return v == null ? null : typeof v === "object" ? (v.displayValue != null ? +v.displayValue : +v.value) : +v; }
      var stt = (cp.status || ev.status || {}).type || {};
      return { id: ev.id, comp: comp[ev.id] || slug, date: ev.date, home: me && me.homeAway === "home", opp: op ? (op.team.shortDisplayName || op.team.displayName) : "", oppId: op ? String(op.team.id) : "", oppLogo: op && op.team.logos && op.team.logos[0] && op.team.logos[0].href,
        done: !!stt.completed, gf: sc(me), ga: sc(op), detail: stt.shortDetail || "" };
    });
    var res = evs.filter(function (e) { return e.done; }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var fix = evs.filter(function (e) { return !e.done; }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var form = $("tForm"); res.slice(0, 5).reverse().forEach(function (e) { var k = e.gf > e.ga ? "W" : e.gf < e.ga ? "L" : "D"; form.appendChild(el("span", k, k)); });
    function list(box, items, done) {
      if (!items.length) { box.appendChild(el("p", "note", done ? "No results yet." : "No fixtures scheduled.")); return; }
      var t = el("table", "tp-list"), tb = el("tbody");
      items.slice(0, done ? 12 : 8).forEach(function (e) {
        var tr = el("tr");
        var dt = el("td", "l", new Date(e.date).toLocaleDateString(undefined, { weekday: done ? undefined : "short", day: "numeric", month: "short" }) + (done ? "" : " " + new Date(e.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })));
        if (!done && intl) { var lc = el("div", "fx-comp"); lc.appendChild(el("span", "chip", NAMES[e.comp][2])); dt.appendChild(lc); }
        tr.appendChild(dt);
        var o = el("td", "l opp"), oi = el("span", "tc"); oi.appendChild(logo(e.oppLogo));
        var link = el("a", "pl-link", (e.home ? "v " : "at ") + e.opp); link.href = "team.html?l=" + encodeURIComponent(e.comp) + "&id=" + encodeURIComponent(e.oppId); oi.appendChild(link); o.appendChild(oi); tr.appendChild(o);
        if (done) { var k = e.gf > e.ga ? "W" : e.gf < e.ga ? "L" : "D"; var td = el("td"); td.appendChild(el("span", "res " + k, k + " " + e.gf + "–" + e.ga)); tr.appendChild(td); }
        tb.appendChild(tr);
      });
      t.appendChild(tb); box.appendChild(t);
    }
    list($("tResults"), res, true); list($("tFixtures"), fix, false);
    if (intl) $("fxH2").parentNode.appendChild(el("span", "eyebrow", "All competitions"));
    // forecast
    var ft = F && F.teams.find(function (t) { return t.id === id; });
    if (ft) {
      $("tForecastCard").hidden = false;
      $("tfNote").textContent = F.sims.toLocaleString() + " simulations of the " + F.remaining + " fixtures left";
      [[slug === "uefa.wchampions" ? "Top spot" : "Title", pct(ft.title)], ["Projected points", ft.proj.toFixed(0)]].concat(F.zones.map(function (z) { return [z.name, pct(ft.zones[z.name])]; }))
        .forEach(function (x) { var d = el("div", "pl-tile"); d.appendChild(el("b", "num", x[1])); d.appendChild(el("span", null, x[0])); $("tForecast").appendChild(d); });
    }
    // squad
    var squad = P ? P.players.filter(function (p) { return p.team === id; }) : [];
    squad.forEach(function (p) { var m = MIN[p.id] || {}; p.min = m.m || 0; p.pp = m.pp || 0; });
    squad.sort(function (a, b) { return (b.min - a.min) || (b.apps - a.apps); });
    if (!squad.length) $("tSquad").appendChild(el("p", "note", "No players in the database for this team yet."));
    else {
      var t = el("table", "tp-squad"), hr = el("tr");
      [["Player", "l"], ["Pos", "l"], ["Apps", ""], ["Min", ""], ["Goals", ""], ["Assists", ""], ["Goals/90", ""], ["Shots", ""], ["Prog. passes", ""], ["Cards", ""]].forEach(function (h) { hr.appendChild(el("th", h[1], h[0])); });
      var thead = el("thead"); thead.appendChild(hr); t.appendChild(thead);
      var tb = el("tbody");
      squad.forEach(function (p) {
        var tr = el("tr", "pl-row"), href = "player.html?l=" + encodeURIComponent(slug) + "&id=" + encodeURIComponent(p.id);
        var n = el("td", "l pl-name"), a = el("a", "pl-link", p.name); a.href = href; n.appendChild(a); if (p.no) n.appendChild(el("span", "pl-pos-tag", "#" + p.no)); tr.appendChild(n);
        tr.appendChild(el("td", "l", p.pos || ""));
        [p.apps, p.min || "—", p.G, p.A, p.min >= 270 ? (p.G / p.min * 90).toFixed(2) : "–", p.SHOT, p.pp, p.YC + p.RC].forEach(function (v) { tr.appendChild(el("td", null, String(v))); });
        tr.addEventListener("click", function (e) { if (!e.target.closest("a")) location.href = href; });
        tb.appendChild(tr);
      });
      t.appendChild(tb); $("tSquad").appendChild(t);
    }
    // team heatmaps: every squad player's season data added together
    if (!H) $("tHeat").appendChild(el("p", "note", "Heatmaps for this competition haven't been built yet."));
    else if (!Object.keys(H.players || {}).length) $("tHeat").appendChild(el("p", "note", "ESPN's play-by-play for this competition has no pitch positions, so there's no heatmap."));
    else {
      var agg = { n: 0, c: {}, s: [], p: 0, pp: 0, pl: [] };
      squad.forEach(function (p) {
        var e = H.players[p.id]; if (!e) return;
        agg.n += e.n; agg.p += e.p || 0; agg.pp += e.pp || 0;
        Object.keys(e.c).forEach(function (k) { agg.c[k] = (agg.c[k] || 0) + e.c[k]; });
        (e.s || []).forEach(function (q) { agg.s.push(q.slice(0, 3).concat([p.name + (q[3] ? " v " + q[3] : ""), q[4], q[5], q[6]])); });
        agg.pl = agg.pl.concat(e.pl || []);
      });
      agg.pl = agg.pl.filter(function (q) { return q[2] < 99 && q[0] < 99; }).slice(-120);
      Heat.seasonPanel($("tHeat"), agg, H.grid, tipFn);
    }
    // head to head picker
    var opps = rows.map(function (e) { return { id: String(e.team.id), name: (e.team.shortDisplayName || e.team.displayName || "").trim() }; }).filter(function (o) { return o.id !== id; });
    var fixHere = fix.filter(function (e) { return e.comp === slug; });
    if (!opps.length) res.concat(fixHere).forEach(function (e) { if (e.oppId && !opps.some(function (o) { return o.id === e.oppId; })) opps.push({ id: e.oppId, name: e.opp }); });
    opps.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var sel = $("h2hSel"); opps.forEach(function (o) { sel.appendChild(new Option(o.name, o.id)); });
    var next = fixHere[0] && fixHere[0].oppId; if (next) sel.value = next;
    function showH2H() {
      var o = opps.find(function (x) { return x.id === sel.value; }); if (!o) return;
      $("tH2H").textContent = ""; $("tH2H").appendChild(el("p", "note", "Loading meetings…"));
      H2H.load(slug, id, o.id).then(function (ms) { H2H.render($("tH2H"), ms, id, name, o.name); });
    }
    sel.addEventListener("change", showH2H);
    if (opps.length) showH2H(); else $("tH2H").appendChild(el("p", "note", "No opponents listed."));
  });
})();
