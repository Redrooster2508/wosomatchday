/* One player's page: profile, freely licensed portrait, season numbers, league percentiles,
   a shots-and-goals chart and the match log. Address: player.html?l=<league slug>&id=<ESPN athlete id> */
(function () {
  "use strict";
  var LEAGUE_NAMES = { "eng.w.1": ["Women's Super League", "wsl"], "esp.w.1": ["Liga F", "ligaf"], "usa.nwsl": ["NWSL", "nwsl"], "uefa.wchampions": ["Women's Champions League", "ucl"],
    "fifa.friendly.w": ["International friendlies", "friendlies"], "fifa.wwcq.ply": ["World Cup qualifying play-offs", "wcq"],
    "concacaf.womens.championship": ["Concacaf W Championship", "wchamp"], "caf.w.nations": ["Women's Africa Cup of Nations", "wafcon"],
    "afc.w.asian.cup": ["AFC Women's Asian Cup", "asian"], "fifa.wwc": ["FIFA Women's World Cup", "wwc"], "uefa.weuro": ["UEFA Women's Euro", "weuro"],
    "conmebol.america.femenina": ["Copa América Femenina", "copa"], "fifa.w.olympics": ["Olympic tournament", "olympics"], "uefa.w.nations": ["UEFA Women's Nations League", "wnl"],
    // men's national teams: no home page tab, so the back link goes to his team's page
    "fifa.friendly": ["Men's international friendlies", null, 1], "fifa.world": ["FIFA World Cup", null, 1], "uefa.nations": ["UEFA Nations League", null, 1],
    "concacaf.nations.league": ["Concacaf Nations League", null, 1], "caf.nations_qual": ["Africa Cup of Nations qualifying", null, 1], "caf.nations": ["Africa Cup of Nations", null, 1],
    "fifa.worldq.uefa": ["World Cup qualifying, Europe", null, 1], "fifa.worldq.conmebol": ["World Cup qualifying, South America", null, 1],
    "fifa.worldq.afc": ["World Cup qualifying, Asia", null, 1], "fifa.worldq.caf": ["World Cup qualifying, Africa", null, 1],
    "fifa.worldq.concacaf": ["World Cup qualifying, Concacaf", null, 1],
    "eng.1": ["Premier League", null, 1], "esp.1": ["LaLiga", null, 1], "uefa.champions": ["UEFA Champions League", null, 1] };
  var qs = new URLSearchParams(location.search), slug = qs.get("l"), id = qs.get("id");
  function $(x) { return document.getElementById(x); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
  function ord(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function plain(h) { var d = document.createElement("div"); d.innerHTML = String(h || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, ""); return (d.textContent || "").replace(/\s+/g, " ").trim(); }

  var tip = $("tip");
  function showTip(e, t) { tip.textContent = t; tip.hidden = false; var x = e.clientX + 14, y = e.clientY + 14; if (x + tip.offsetWidth > innerWidth - 8) x = e.clientX - tip.offsetWidth - 14; if (y + tip.offsetHeight > innerHeight - 8) y = e.clientY - tip.offsetHeight - 14; tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px"; }
  function hideTip() { tip.hidden = true; }

  if (!slug || !LEAGUE_NAMES[slug] || !/^\d+$/.test(id || "")) { $("pName").textContent = "Player not found"; return; }
  $("pLeague").textContent = LEAGUE_NAMES[slug][0];
  var MEN = !!LEAGUE_NAMES[slug][2], her = MEN ? "his" : "her", him = MEN ? "him" : "her", nationalSide = null;
  $("back").href = LEAGUE_NAMES[slug][1] ? "./#" + LEAGUE_NAMES[slug][1] : "./";
  if (MEN) $("hH").textContent = "Where he plays";

  function line(pos) {
    pos = String(pos || "").toUpperCase();
    if (pos === "G" || pos === "GK") return "GK";
    if (/^(CD|LB|RB|D|SW|WB|LWB|RWB)/.test(pos)) return "DF";
    if (/^(F|CF|ST|LW|RW|W|SS)/.test(pos)) return "FW";
    if (/M/.test(pos)) return "MF";
    return "";
  }

  Promise.all([getJSON("data/" + slug + "/players.json"), getJSON("data/" + slug + "/matches.json"), getJSON("data/" + slug + "/heat.json").catch(function () { return null; })]).then(function (res) {
    var P = res[0], M = res[1], H = res[2], p = P.players.find(function (x) { return x.id === id; });
    var hp = H && H.players[id] || null;
    if (hp && hp.m) { p.min = hp.m; p.mm = hp.mm || {}; }
    // minutes for everyone, for per-90 percentiles
    if (H) P.players.forEach(function (x) { var e = H.players[x.id]; if (e && e.m) x.min = e.m; });
    if (!p) { $("pName").textContent = "Player not found in this competition"; return; }
    var team = P.teams[p.team] || {};
    document.title = p.name + " · Matchday Hub";
    $("pName").textContent = p.name;
    var club = $("pClub"); if (team.logo) { var im = new Image(); im.src = team.logo; im.alt = ""; club.appendChild(im); }
    var cl = el("a", "pl-link", team.name || ""); cl.href = "team.html?l=" + encodeURIComponent(slug) + "&id=" + encodeURIComponent(p.team); club.appendChild(cl);
    if (MEN) { $("back").href = cl.href; $("back").textContent = "← " + (team.name || "Team"); }
    nationalSide = /^(fifa|uefa\.nations|concacaf\.nations|caf\.nations)/.test(slug) ? p.team : null;
    $("pInitials").textContent = p.name.split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("");
    $("pSeason").textContent = (P.season || "") + " · " + P.matches + " matches in the database";
    facts([["Position", p.pos === "SUB" ? "" : p.pos], ["Shirt", p.no ? "#" + p.no : ""]]);
    tiles(p);
    ranks(p, P.players);
    var log = matchLog(p, M), gk = line(p.pos) === "GK";
    if (gk) {
      $("cH").textContent = "Saves and goals conceded by match";
      $("cH").nextElementSibling.innerHTML = 'Oldest to newest · <span class="sw" style="background:var(--seq)"></span>Saves <span class="dotkey" style="background:var(--loss)"></span>Goal conceded';
    }
    chart(log, gk);
    table(log, M, p.mm);
    profile(p, team);
    if (!H) $("pHeat").appendChild(el("p", "note", "Heatmaps for this competition haven't been built yet."));
    else if (!Object.keys(H.players || {}).length) $("pHeat").appendChild(el("p", "note", "ESPN's play-by-play for this competition has no pitch positions, so there's no heatmap."));
    else Heat.seasonPanel($("pHeat"), hp, H.grid, function (e, t) { if (e) showTip(e, t); else hideTip(); });
  }).catch(function () { $("pName").textContent = "Player stats for this competition haven't been built yet."; });

  function facts(list, after) {
    var dl = $("pFacts");
    list.forEach(function (f) {
      if (!f[1]) return;
      var existing = dl.querySelector('[data-k="' + f[0] + '"]');
      if (existing) { existing.querySelector("dd").textContent = ""; existing.querySelector("dd").appendChild(typeof f[1] === "string" ? document.createTextNode(f[1]) : f[1]); return; }
      var d = el("div"); d.dataset.k = f[0]; d.appendChild(el("dt", null, f[0]));
      var dd = el("dd"); dd.appendChild(typeof f[1] === "string" ? document.createTextNode(f[1]) : f[1]); d.appendChild(dd);
      var prev = after && dl.querySelector('[data-k="' + after + '"]');
      if (prev) { dl.insertBefore(d, prev.nextSibling); after = f[0]; } else dl.appendChild(d);
    });
  }

  function tiles(p) {
    var gk = line(p.pos) === "GK", box = $("pTiles");
    var conv = p.SHOT ? Math.round(100 * p.G / p.SHOT) + "%" : "—";
    function p90(v) { return p.min ? (v / p.min * 90).toFixed(2) : "—"; }
    // per-90 tiles need minutes; until a competition's minutes are built, show starts and raw counts instead
    var list = gk
      ? (p.min ? [["Apps", p.apps], ["Minutes", p.min], ["Saves", p.SV], ["Conceded", p.GA], ["Clean sheets", p.cs], ["Saves per 90", p90(p.SV)], ["Cards", p.YC + p.RC]]
               : [["Apps", p.apps], ["Starts", p.starts], ["Saves", p.SV], ["Conceded", p.GA], ["Clean sheets", p.cs], ["Saves/app", p.apps ? (p.SV / p.apps).toFixed(1) : "—"], ["Cards", p.YC + p.RC]])
      : (p.min ? [["Apps", p.apps], ["Minutes", p.min], ["Goals", p.G], ["Assists", p.A], ["Goals per 90", p90(p.G)], ["Shots", p.SHOT], ["Shots per 90", p90(p.SHOT)], ["Conversion", conv], ["Cards", p.YC + p.RC]]
               : [["Apps", p.apps], ["Starts", p.starts], ["Goals", p.G], ["Assists", p.A], ["Shots", p.SHOT], ["On target", p.SOG], ["Conversion", conv], ["Fouls won", p.FA], ["Cards", p.YC + p.RC]]);
    list.forEach(function (t) { var d = el("div", "pl-tile"); d.appendChild(el("b", "num", String(t[1]))); d.appendChild(el("span", null, t[0])); box.appendChild(d); });
  }

  // Percentile against everyone with 3+ appearances (goalkeepers against goalkeepers).
  function ranks(p, all) {
    var gk = line(p.pos) === "GK", per90 = !!p.min;
    // per 90 minutes when minutes are known (needs 270+ minutes), otherwise per appearance
    var pool = all.filter(function (x) { return (per90 ? x.min >= 270 : x.apps >= 3) && (line(x.pos) === "GK") === gk; });
    var unit = per90 ? " per 90" : " per app";
    function rate(v, x) { return per90 ? v / x.min * 90 : v / x.apps; }
    var metrics = gk
      ? [["Saves" + unit, function (x) { return rate(x.SV, x); }, 2], ["Clean sheets", function (x) { return x.cs; }, 0], ["Conceded" + unit + " (fewer is better)", function (x) { return -rate(x.GA, x); }, 2, true]]
      : [["Goals" + unit, function (x) { return rate(x.G, x); }, 2], ["Assists" + unit, function (x) { return rate(x.A, x); }, 2], ["Shots" + unit, function (x) { return rate(x.SHOT, x); }, 2],
         ["Shots on target %", function (x) { return x.SHOT ? x.SOG / x.SHOT * 100 : 0; }, 0], ["Fouls won" + unit, function (x) { return rate(x.FA, x); }, 2]];
    $("rH").nextElementSibling.textContent = "Percentile among " + (gk ? "goalkeepers" : "outfield players") + (per90 ? " with 270+ minutes" : " with 3+ apps");
    var box = $("pRanks");
    if ((per90 ? p.min < 270 : p.apps < 3) || pool.length < 5) { box.appendChild(el("p", "note", per90 ? "Percentiles appear after 270 minutes." : "Percentiles appear after three appearances.")); return; }
    metrics.forEach(function (m) {
      var v = m[1](p), vals = pool.map(m[1]).sort(function (a, b) { return a - b; });
      var below = vals.filter(function (x) { return x < v; }).length, pctile = Math.round(100 * below / (vals.length - 1 || 1));
      var rank = vals.length - vals.lastIndexOf(v);
      var row = el("div", "pp-rank");
      row.appendChild(el("span", "pp-rl", m[0].replace(" (fewer is better)", "")));
      var bar = el("div", "bk-bar"), fill = el("i"); fill.style.width = Math.max(2, pctile) + "%"; bar.appendChild(fill); row.appendChild(bar);
      var shown = m[3] ? -v : v;
      row.appendChild(el("b", "num", shown.toFixed(m[2]) + (m[0].indexOf("%") > 0 ? "%" : "")));
      row.appendChild(el("span", "pp-rk num", ord(rank) + " of " + vals.length));
      bar.addEventListener("pointermove", function (e) { showTip(e, m[0] + ": " + shown.toFixed(m[2]) + "\nBetter than " + pctile + "% of " + (gk ? "goalkeepers" : "outfield players") + (per90 ? " with 270+ minutes" : " with 3+ apps")); });
      bar.addEventListener("pointerleave", hideTip);
      box.appendChild(row);
    });
  }

  // matches.json keeps each player's line as a row: id, team, position, shirt, started, then the stats in M.stats order
  function matchLog(p, M) {
    var S = M.stats, rows = [];
    Object.keys(M.matches).forEach(function (mid) {
      var m = M.matches[mid], ln = m.players.find(function (x) { return x[0] === p.id; });
      if (!ln) return;
      var s = {}; S.forEach(function (k, i) { s[k] = ln[5 + i] || 0; });
      var home = ln[1] === m.home, gf = home ? m.score[0] : m.score[1], ga = home ? m.score[1] : m.score[0];
      rows.push({ id: mid, date: m.date, home: home, opp: M.teams[home ? m.away : m.home] || {}, gf: gf, ga: ga, res: gf > ga ? "W" : gf < ga ? "L" : "D", start: ln[4], s: s });
    });
    return rows.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
  }

  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, a, parent) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; }
  // Outfield: shots (on target inside) with a dot per goal. Goalkeepers: saves with a red dot per goal conceded.
  function chart(rows, gk) {
    var box = $("pChart"); box.textContent = "";
    if (!rows.length) { box.appendChild(el("p", "note", "No matches yet.")); return; }
    var W = Math.max(300, box.clientWidth || 520), H = 210, ml = 26, mr = 8, mt = 34, mb = 30;
    var bar = function (r) { return gk ? r.s.SV : r.s.SHOT; }, dots = function (r) { return gk ? r.ga : r.s.G; };
    var max = Math.max(2, Math.max.apply(null, rows.map(bar)));
    var step = (W - ml - mr) / rows.length, bw = Math.min(26, step * 0.6);
    function Y(v) { return mt + (1 - v / max) * (H - mt - mb); }
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "Shots, shots on target and goals in each match" }, box);
    var ticks = max <= 4 ? [0, 1, 2, 3, 4].filter(function (t) { return t <= max; }) : [0, Math.round(max / 2), max];
    ticks.forEach(function (t) { sv("line", { x1: ml, x2: W - mr, y1: Y(t), y2: Y(t), class: "grid" }, svg); sv("text", { x: ml - 6, y: Y(t) + 4, "text-anchor": "end" }, svg).textContent = t; });
    rows.forEach(function (r, i) {
      var x = ml + step * i + (step - bw) / 2, g = sv("g", {}, svg);
      if (gk) {
        if (r.s.SV) sv("rect", { x: x, y: Y(r.s.SV), width: bw, height: Y(0) - Y(r.s.SV), rx: 3, fill: "var(--seq)" }, g);
      } else {
        if (r.s.SHOT) sv("rect", { x: x, y: Y(r.s.SHOT), width: bw, height: Y(0) - Y(r.s.SHOT), rx: 3, fill: "var(--draw)" }, g);
        if (r.s.SOG) sv("rect", { x: x, y: Y(r.s.SOG), width: bw, height: Y(0) - Y(r.s.SOG), rx: 3, fill: "var(--seq)", stroke: "var(--panel)", "stroke-width": 1.5 }, g);
      }
      for (var k = 0; k < dots(r); k++) sv("circle", { cx: x + bw / 2, cy: Y(bar(r) || 0) - 8 - k * 11, r: 4.5, fill: gk ? "var(--loss)" : "var(--ink)", stroke: "var(--panel)", "stroke-width": 1.5 }, g);
      if (rows.length <= 16 || i % Math.ceil(rows.length / 12) === 0) sv("text", { x: x + bw / 2, y: H - 12, "text-anchor": "middle" }, svg).textContent = r.opp.abbr || "";
      var hit = sv("rect", { x: ml + step * i, y: mt, width: step, height: H - mt - mb, fill: "transparent" }, g);
      hit.addEventListener("pointermove", function (e) { showTip(e, new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + "  " + (r.home ? "v " : "at ") + (r.opp.name || "") + "  " + r.res + " " + r.gf + "–" + r.ga + "\n" + (gk ? r.s.SV + " saves · " + r.ga + " conceded" : r.s.SHOT + " shots · " + r.s.SOG + " on target · " + r.s.G + " goals · " + r.s.A + " assists")); });
      hit.addEventListener("pointerleave", hideTip);
    });
  }

  function table(rows, M, mm) {
    var box = $("pLog"); box.textContent = "";
    var t = el("table", "pl-log"), thead = el("thead"), hr = el("tr");
    ["Date", "Opponent", "Result", "", "Min", "Goals", "Assists", "Shots", "On target", "Saves", "Fouls", "Cards"].forEach(function (x, i) { hr.appendChild(el("th", i < 2 ? "l" : "", x)); });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el("tbody");
    rows.slice().reverse().forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", "l", new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })));
      var o = el("td", "l"), oi = el("span", "tc"); if (r.opp.logo) { var im = new Image(); im.src = r.opp.logo; im.alt = ""; im.loading = "lazy"; oi.appendChild(im); } oi.appendChild(el("span", null, (r.home ? "v " : "at ") + (r.opp.name || ""))); o.appendChild(oi); tr.appendChild(o);
      var rc = el("td"); rc.appendChild(el("span", "res " + r.res, r.res + " " + r.gf + "–" + r.ga)); tr.appendChild(rc);
      tr.appendChild(el("td", "pl-sub", r.start ? "Start" : "Sub"));
      tr.appendChild(el("td", "num", mm && mm[r.id] ? mm[r.id] + "'" : "—"));
      [r.s.G, r.s.A, r.s.SHOT, r.s.SOG, r.s.SV, r.s.FC].forEach(function (v) { tr.appendChild(el("td", v ? "hit" : "zero", String(v))); });
      var cards = el("td"); for (var y = 0; y < r.s.YC; y++) cards.appendChild(el("span", "bk-card y", "")); for (var z = 0; z < r.s.RC; z++) cards.appendChild(el("span", "bk-card r", ""));
      tr.appendChild(cards); tb.appendChild(tr);
    });
    t.appendChild(tb); box.appendChild(t);
  }

  // ESPN gives imperial measurements ("5' 11\"", "172 lbs"); show metric first, imperial after.
  function height(txt) {
    var m = String(txt || "").match(/(\d+)\s*'\s*(\d+)?/);
    if (!m) return "";
    var inches = +m[1] * 12 + (+m[2] || 0);
    return (inches * 2.54 / 100).toFixed(2) + " m (" + m[1] + " ft " + (+m[2] || 0) + " in)";
  }
  function weight(txt) {
    var m = String(txt || "").match(/(\d+(?:\.\d+)?)\s*lb/i);
    return m ? Math.round(+m[1] * 0.45359237) + " kg (" + Math.round(+m[1]) + " lb)" : "";
  }

  // ESPN profile (age, height, nationality), then her Wikidata entry: a freely licensed portrait, birthplace and career.
  function profile(p, team) {
    var photo = $("pPhoto");
    photo.style.setProperty("--club", "#" + String(team.color || "334455").replace("#", ""));
    var espn = getJSON("https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/" + encodeURIComponent(p.id)).then(function (d) {
      var a = d.athlete || {};
      var nat = null;
      if (a.citizenship) {
        nat = el("span", "tc");
        if (a.flag && /^https:\/\//.test(a.flag.href)) { var f = new Image(); f.src = a.flag.href; f.alt = ""; f.className = "pp-flag"; nat.appendChild(f); }
        nat.appendChild(document.createTextNode(a.citizenship));
      }
      var dob = dobOf(a.displayDOB);
      // a men's national team player's club, linked to its page when it's in the player database
      var club = null, ct = a.team;
      if (MEN && nationalSide && ct && ct.id && String(ct.id) !== nationalSide && /^\d+$/.test(String(ct.id))) {
        club = el("a", "pl-link", ct.displayName || ct.name || ""); club.href = "team.html?id=" + encodeURIComponent(ct.id);
      }
      facts([["Position", a.position && a.position.displayName], ["Club", club], ["Nationality", nat],
        ["Age", a.age ? a.age + (dob ? " (born " + new Date(dob + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) + ")" : "") : ""],
        ["Height", height(a.displayHeight)], ["Weight", weight(a.displayWeight)]]);
      return { dob: dob, nat: a.citizenship };
    }).catch(function () { return {}; });
    espn.then(function (a) {
      return entity(p.name, a.dob).then(function (hit) {
        if (!hit) { careerNote("There's no Wikidata entry for " + him + " yet, so no career history."); return; }
        origin(hit.id, a.nat);
        career(hit.id);
        return portrait(hit, p.name).then(function (img) {
          if (!img) return;
          var im = new Image(); im.src = img.url; im.alt = "Portrait of " + p.name; im.className = "pp-img";
          im.onload = function () { photo.classList.add("has-img"); };
          photo.insertBefore(im, photo.firstChild);
          var cap = $("pCredit"); cap.textContent = "Photo (" + img.year + "): ";
          var l = el("a", null, img.credit); l.href = img.source; l.target = "_blank"; l.rel = "noopener"; cap.appendChild(l);
        });
      });
    }).catch(function () { careerNote("Couldn't reach Wikidata for " + her + " career history. Try again later."); });
  }
  // ESPN writes dates of birth as D/M/YYYY
  function dobOf(txt) {
    var m = String(txt || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) : null;
  }

  var OK_LICENCE = /^(cc[ -]by(-sa)?([ -][\d.]+)?|cc0|public domain|pd)/i, SINCE = 2023;
  function fold(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function yearOf(meta, title) {
    var ys = (plain(meta.DateTimeOriginal && meta.DateTimeOriginal.value).match(/(?:19|20)\d\d/g) || String(title).match(/(?:19|20)\d\d/g) || []).map(Number);
    return ys.length ? Math.max.apply(null, ys) : null;
  }
  // A freely licensed portrait taken in 2023 or later, chosen to look like a profile photo: head and shoulders,
  // taller than wide, just her, newest first. Candidates are her main Wikidata image and her Commons category.
  // Older photos are not shown.
  var W = "https://www.wikidata.org/w/api.php?origin=*&format=json&";
  // Her Wikidata item: a female (Q6581072) association football player (Q937857) with this name; male (Q6581097) in men's competitions.
  // When ESPN gives a date of birth, a namesake born on another day is skipped.
  function entity(name, dob) {
    return getJSON(W + "action=wbsearchentities&language=en&limit=7&type=item&search=" + encodeURIComponent(name)).then(function (s) {
      var ids = (s.search || []).map(function (x) { return x.id; });
      if (!ids.length) return null;
      return getJSON(W + "action=wbgetentities&props=claims&ids=" + ids.join("|")).then(function (e) {
        var players = ids.map(function (i) { return e.entities[i]; }).filter(function (en) {
          var c = en && en.claims || {};
          function has(prop, q) { return (c[prop] || []).some(function (x) { var v = x.mainsnak && x.mainsnak.datavalue; return v && v.value && v.value.id === q; }); }
          return has("P106", "Q937857") && has("P21", MEN ? "Q6581097" : "Q6581072");
        });
        function born(en) {
          var c = en.claims.P569, v = c && c[0] && c[0].mainsnak.datavalue && c[0].mainsnak.datavalue.value;
          if (!v || !dob) return "unknown";
          return v.time.slice(1, v.precision >= 11 ? 11 : 5) === dob.slice(0, v.precision >= 11 ? 10 : 4) ? "same" : "other";
        }
        return players.find(function (en) { return born(en) === "same"; }) || players.find(function (en) { return born(en) === "unknown"; }) || null;
      });
    });
  }
  function portrait(hit, name) {
    var C = "https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=600&";
    var surname = fold(name.split(/\s+/).slice(-1)[0]);
    function usable(pg) {
      var ii = pg && pg.imageinfo && pg.imageinfo[0]; if (!ii) return null;
      var meta = ii.extmetadata || {}, lic = plain(meta.LicenseShortName && meta.LicenseShortName.value), year = yearOf(meta, pg.title);
      if (!OK_LICENCE.test(lic) || !year || year < SINCE || !/\.(jpe?g|png|webp)$/i.test(pg.title)) return null;
      var who = plain(meta.Artist && meta.Artist.value).slice(0, 80) || "Unknown author";
      return { id: pg.pageid, url: ii.thumburl || ii.url, year: year, ratio: ii.height / Math.max(1, ii.width), title: pg.title, credit: who + ", " + lic + ", via Wikimedia Commons", source: ii.descriptionurl };
    }
    // how much a photo looks like a profile photo
    function score(img, isMain) {
      var t = fold(img.title), s = img.year * 4;                              // newer is better, but a recent photo of something else isn't
      if (img.her) s += 6;                                                    // tagged on Commons as showing her
      if (img.ratio >= 1.15) s += 8; else if (img.ratio >= 0.95) s += 3;       // portrait shape
      if (/\(cropped\)/.test(t)) s += 6;                                      // Commons crops are usually head and shoulders
      if (/ (v|vs|versus|against) |starting xi|line-?up|team|squad|celebrat|training|stadium/.test(t)) s -= 6;  // match or group scenes
      if (/ and |, .*,| & /.test(t.replace(/\.[a-z]+$/, ""))) s -= 4;          // several people named
      if (isMain) s += 2;                                                       // her main Wikidata image, all else equal
      return s;
    }
    function val(prop) { var c = hit.claims[prop]; return c && c[0] && c[0].mainsnak.datavalue ? c[0].mainsnak.datavalue.value : null; }
    var main = val("P18"), cat = val("P373");
    depicts.q = hit.id;
    var first = main ? getJSON(C + "titles=" + encodeURIComponent("File:" + main)).then(function (r) { var pgs = r.query && r.query.pages; return usable(pgs && pgs[Object.keys(pgs)[0]]); }).catch(function () { return null; }) : Promise.resolve(null);
    var more = cat ? getJSON(C + "generator=categorymembers&gcmtype=file&gcmlimit=50&gcmsort=timestamp&gcmdir=desc&gcmtitle=" + encodeURIComponent("Category:" + cat)).then(function (r) {
      return Object.keys((r.query && r.query.pages) || {}).map(function (k) { return usable(r.query.pages[k]); })
        .filter(function (x) { return x && fold(x.title).indexOf(surname) >= 0; });
    }).catch(function () { return []; }) : Promise.resolve([]);
    return Promise.all([first, more]).then(function (r) {
      var list = (r[0] ? [Object.assign(r[0], { main: true })] : []).concat(r[1].filter(function (x) { return !r[0] || x.title !== r[0].title; }));
      return depicts(list).then(function () { return list.filter(function (x) { return x.main || x.her !== false; }); });
    }).then(function (list) {
      list.sort(function (a, b) { return score(b, b.main) - score(a, a.main); });
      return list[0] || null;
    });
  }

  // Commons "depicts" tags (P180) on each file: mark files tagged as her (her = true) or only as something
  // or someone else (her = false), such as a sign or a stadium named after her. Untagged files stay undecided.
  function depicts(list) {
    var ids = list.filter(function (x) { return x.id; }).slice(0, 50).map(function (x) { return "M" + x.id; });
    if (!ids.length) return Promise.resolve();
    return getJSON("https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=wbgetentities&props=claims&ids=" + ids.join("|")).then(function (r) {
      list.forEach(function (x) {
        var en = r.entities && r.entities["M" + x.id], st = en && !Array.isArray(en.statements) && en.statements || {};
        var tags = (st.P180 || []).map(function (c) { var v = c.mainsnak && c.mainsnak.datavalue; return v && v.value && v.value.id; }).filter(Boolean);
        if (tags.length) x.her = tags.indexOf(depicts.q) >= 0;
      });
    }).catch(function () {});
  }

  // Wikidata's query service (CC0 data, open to browsers). Values come back as strings.
  function sparql(q) {
    return getJSON("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q)).then(function (r) {
      return r.results.bindings.map(function (b) { var o = {}; for (var k in b) o[k] = b[k].value; return o; });
    });
  }
  // Where she was born, and the national team she plays for if ESPN didn't say.
  function origin(q, espnNat) {
    sparql("SELECT ?birthLabel ?countryLabel ?sportLabel ?article WHERE {" +
      " OPTIONAL { wd:" + q + " wdt:P19 ?birth. OPTIONAL { ?birth wdt:P17 ?country } }" +
      " OPTIONAL { wd:" + q + " wdt:P1532 ?sport }" +
      " OPTIONAL { ?article schema:about wd:" + q + "; schema:isPartOf <https://en.wikipedia.org/> }" +
      ' SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 1').then(function (rows) {
      var r = rows[0] || {}, place = r.birthLabel && !/^Q\d+$/.test(r.birthLabel) ? r.birthLabel : "";
      if (place && r.countryLabel && r.countryLabel !== place) place += ", " + r.countryLabel;
      facts([["Born in", place]], "Age");
      if (!espnNat) facts([["Nationality", r.sportLabel]]);
      if (/^https:\/\/en\.wikipedia\.org\//.test(r.article || "")) {
        $("pCareerMore").textContent = " · ";
        var a = el("a", "pl-link", "Read more on Wikipedia ↗"); a.href = r.article; a.target = "_blank"; a.rel = "noopener";
        $("pCareerMore").appendChild(a);
      }
    }).catch(function () {});
  }

  function careerNote(t) { var box = $("pCareer"); box.textContent = ""; box.appendChild(el("p", "note", t)); }
  // Every team she has been registered with (Wikidata P54), with dates, appearances and goals where recorded.
  function career(q) {
    sparql("SELECT ?st ?team ?teamLabel ?start ?end ?apps ?goals ?asof ?nat ?countryLabel WHERE {" +
      " wd:" + q + " p:P54 ?st. ?st ps:P54 ?team." +
      " OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end } OPTIONAL { ?st pq:P1350 ?apps }" +
      " OPTIONAL { ?st pq:P1351 ?goals } OPTIONAL { ?st pq:P585 ?asof } OPTIONAL { ?team wdt:P17 ?country }" +
      " BIND(EXISTS { ?team wdt:P31/wdt:P279* wd:Q6979593 } AS ?nat)" +
      ' SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }').then(function (rows) {
      var seen = {}, spells = rows.filter(function (r) { if (seen[r.st]) return false; seen[r.st] = 1; return true; });
      if (!spells.length) { careerNote("Wikidata doesn't list " + her + " teams yet."); return; }
      function yr(t) { return t ? +t.slice(0, 4) : null; }
      spells.forEach(function (r) { r.y0 = yr(r.start); r.y1 = yr(r.end); });
      spells.sort(function (a, b) { return (a.y0 || 9999) - (b.y0 || 9999) || (a.y1 || 9999) - (b.y1 || 9999); });
      var box = $("pCareer"); box.textContent = "";
      var clubs = spells.filter(function (r) { return r.nat !== "true"; }), intl = spells.filter(function (r) { return r.nat === "true"; });
      if (clubs.length) box.appendChild(careerTable("Clubs", clubs, true));
      if (intl.length) box.appendChild(careerTable("International", intl, false));
    }).catch(function () { careerNote("Couldn't reach Wikidata for " + her + " career history. Try again later."); });
  }
  // "Canada women's national under-20 soccer team" -> "Canada U20"; "Spain national football team" -> "Spain"
  function teamName(t) {
    if (!t || /^Q\d+$/.test(t)) return "Unnamed team";
    return t.replace(/ (?:women's |men's )?national (?:under-(\d+) )?(?:association )?(?:soccer |football )?team$/i, function (m, u) { return u ? " U" + u : ""; });
  }
  function careerTable(title, spells, withCountry) {
    var wrap = el("div", "pp-career"), asof = spells.some(function (r) { return r.asof; }), stats = spells.some(function (r) { return r.apps || r.goals; });
    wrap.appendChild(el("h3", null, title));
    var tw = el("div", "tbl-wrap"), t = el("table", "pl-log pp-ct"), hr = el("tr"), tb = el("tbody");
    ["Years", "Team"].concat(withCountry ? ["Country"] : []).concat(stats ? ["Apps", "Goals"] : []).concat(asof ? ["As of"] : []).forEach(function (x, i) { hr.appendChild(el("th", (i < (withCountry ? 3 : 2) ? "l" : "") + (x === "Country" || x === "As of" ? " pp-ct-col" : ""), x)); });
    var th = el("thead"); th.appendChild(hr); t.appendChild(th);
    spells.slice().reverse().forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", "l num", !r.y0 ? (r.y1 ? "–" + r.y1 : "") : r.y1 === r.y0 ? String(r.y0) : r.y0 + "–" + (r.y1 || "")));
      var tn = el("td", "l", teamName(r.teamLabel)), when = r.asof ? new Date(r.asof).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "";
      // on phones the country and stats date go under the name instead of in their own columns
      var sub = [withCountry ? r.countryLabel : "", when ? "stats to " + when : ""].filter(Boolean).join(" · ");
      if (sub) tn.appendChild(el("span", "pp-ct-c", sub));
      tr.appendChild(tn);
      if (withCountry) tr.appendChild(el("td", "l pp-ct-col", r.countryLabel || ""));
      if (stats) {
        tr.appendChild(el("td", r.apps ? "num" : "zero", r.apps || "—"));
        tr.appendChild(el("td", r.goals ? "num hit" : "zero", r.goals || (r.apps ? "0" : "—")));
      }
      if (asof) tr.appendChild(el("td", "pl-sub pp-ct-col", when));
      tb.appendChild(tr);
    });
    t.appendChild(tb); tw.appendChild(t); wrap.appendChild(tw);
    return wrap;
  }
})();
