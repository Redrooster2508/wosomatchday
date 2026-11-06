/* One player's page: profile, freely licensed portrait, season numbers, league percentiles,
   a shots-and-goals chart and the match log. Address: player.html?l=<league slug>&id=<ESPN athlete id> */
(function () {
  "use strict";
  var LEAGUE_NAMES = { "eng.w.1": ["Women's Super League", "wsl"], "esp.w.1": ["Liga F", "ligaf"], "usa.nwsl": ["NWSL", "nwsl"], "uefa.wchampions": ["Women's Champions League", "ucl"],
    "fifa.friendly.w": ["International friendlies", "friendlies"], "fifa.wwcq.ply": ["World Cup qualifying play-offs", "wcq"],
    "concacaf.womens.championship": ["Concacaf W Championship", "wchamp"], "caf.w.nations": ["Women's Africa Cup of Nations", "wafcon"],
    "afc.w.asian.cup": ["AFC Women's Asian Cup", "asian"], "fifa.wwc": ["FIFA Women's World Cup", "wwc"], "uefa.weuro": ["UEFA Women's Euro", "weuro"],
    "conmebol.america.femenina": ["Copa América Femenina", "copa"], "fifa.w.olympics": ["Olympic tournament", "olympics"], "uefa.w.nations": ["UEFA Women's Nations League", "wnl"] };
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
  $("back").href = "./#" + LEAGUE_NAMES[slug][1];

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

  function facts(list) {
    var dl = $("pFacts");
    list.forEach(function (f) {
      if (!f[1]) return;
      var existing = dl.querySelector('[data-k="' + f[0] + '"]');
      if (existing) { existing.querySelector("dd").textContent = ""; existing.querySelector("dd").appendChild(typeof f[1] === "string" ? document.createTextNode(f[1]) : f[1]); return; }
      var d = el("div"); d.dataset.k = f[0]; d.appendChild(el("dt", null, f[0]));
      var dd = el("dd"); dd.appendChild(typeof f[1] === "string" ? document.createTextNode(f[1]) : f[1]); d.appendChild(dd); dl.appendChild(d);
    });
  }

  function tiles(p) {
    var gk = line(p.pos) === "GK", box = $("pTiles");
    var conv = p.SHOT ? Math.round(100 * p.G / p.SHOT) + "%" : "—";
    function p90(v) { return p.min ? (v / p.min * 90).toFixed(2) : "—"; }
    var list = gk
      ? [["Apps", p.apps], ["Minutes", p.min || "—"], ["Saves", p.SV], ["Conceded", p.GA], ["Clean sheets", p.cs], ["Saves per 90", p90(p.SV)], ["Cards", p.YC + p.RC]]
      : [["Apps", p.apps], ["Minutes", p.min || "—"], ["Goals", p.G], ["Assists", p.A], ["Goals per 90", p90(p.G)], ["Shots", p.SHOT], ["Shots per 90", p90(p.SHOT)], ["Conversion", conv], ["Cards", p.YC + p.RC]];
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

  function matchLog(p, M) {
    var S = M.stats, rows = [];
    Object.keys(M.matches).forEach(function (mid) {
      var m = M.matches[mid], ln = m.players.find(function (x) { return x.id === p.id; });
      if (!ln) return;
      var s = {}; S.forEach(function (k, i) { s[k] = ln.s[i] || 0; });
      var home = ln.team === m.home, gf = home ? m.score[0] : m.score[1], ga = home ? m.score[1] : m.score[0];
      rows.push({ id: mid, date: m.date, home: home, opp: m.teams[home ? m.away : m.home] || {}, gf: gf, ga: ga, res: gf > ga ? "W" : gf < ga ? "L" : "D", start: ln.start, s: s });
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

  // ESPN profile (age, height, nationality), then a freely licensed portrait from Wikidata / Commons.
  function profile(p, team) {
    var photo = $("pPhoto");
    photo.style.setProperty("--club", "#" + String(team.color || "334455").replace("#", ""));
    getJSON("https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/" + encodeURIComponent(p.id)).then(function (d) {
      var a = d.athlete || {};
      var nat = null;
      if (a.citizenship) {
        nat = el("span", "tc");
        if (a.flag && /^https:\/\//.test(a.flag.href)) { var f = new Image(); f.src = a.flag.href; f.alt = ""; f.className = "pp-flag"; nat.appendChild(f); }
        nat.appendChild(document.createTextNode(a.citizenship));
      }
      facts([["Position", a.position && a.position.displayName], ["Nationality", nat], ["Age", a.age ? a.age + (a.displayDOB ? " (born " + a.displayDOB + ")" : "") : ""],
        ["Height", height(a.displayHeight)], ["Weight", weight(a.displayWeight)]]);
    }).catch(function () {});
    portrait(p.name).then(function (img) {
      if (!img) return;
      var im = new Image(); im.src = img.url; im.alt = "Portrait of " + p.name; im.className = "pp-img";
      im.onload = function () { photo.classList.add("has-img"); };
      photo.insertBefore(im, photo.firstChild);
      var cap = $("pCredit"); cap.textContent = "Photo (" + img.year + "): ";
      var a = el("a", null, img.credit); a.href = img.source; a.target = "_blank"; a.rel = "noopener"; cap.appendChild(a);
    }).catch(function () {});
  }

  var OK_LICENCE = /^(cc[ -]by(-sa)?([ -][\d.]+)?|cc0|public domain|pd)/i, SINCE = 2023;
  function fold(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function yearOf(meta, title) {
    var ys = (plain(meta.DateTimeOriginal && meta.DateTimeOriginal.value).match(/(?:19|20)\d\d/g) || String(title).match(/(?:19|20)\d\d/g) || []).map(Number);
    return ys.length ? Math.max.apply(null, ys) : null;
  }
  // A freely licensed portrait taken in 2023 or later: the player's main Wikidata image if it is recent,
  // otherwise the newest suitable photo in her Commons category. Older photos are not shown.
  function portrait(name) {
    var W = "https://www.wikidata.org/w/api.php?origin=*&format=json&";
    var C = "https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=600&";
    var surname = fold(name.split(/\s+/).slice(-1)[0]);
    function usable(pg) {
      var ii = pg && pg.imageinfo && pg.imageinfo[0]; if (!ii) return null;
      var meta = ii.extmetadata || {}, lic = plain(meta.LicenseShortName && meta.LicenseShortName.value), year = yearOf(meta, pg.title);
      if (!OK_LICENCE.test(lic) || !year || year < SINCE || !/\.(jpe?g|png|webp)$/i.test(pg.title)) return null;
      var who = plain(meta.Artist && meta.Artist.value).slice(0, 80) || "Unknown author";
      return { url: ii.thumburl || ii.url, year: year, tall: ii.height >= ii.width, title: pg.title, credit: who + ", " + lic + ", via Wikimedia Commons", source: ii.descriptionurl };
    }
    return getJSON(W + "action=wbsearchentities&language=en&limit=7&type=item&search=" + encodeURIComponent(name)).then(function (s) {
      var ids = (s.search || []).map(function (x) { return x.id; });
      if (!ids.length) return null;
      return getJSON(W + "action=wbgetentities&props=claims&ids=" + ids.join("|")).then(function (e) {
        // an association football player (Q937857), female (Q6581072)
        var hit = ids.map(function (i) { return e.entities[i]; }).find(function (en) {
          var c = en && en.claims || {};
          function has(prop, q) { return (c[prop] || []).some(function (x) { var v = x.mainsnak && x.mainsnak.datavalue; return v && v.value && v.value.id === q; }); }
          return has("P106", "Q937857") && has("P21", "Q6581072");
        });
        if (!hit) return null;
        function val(prop) { var c = hit.claims[prop]; return c && c[0] && c[0].mainsnak.datavalue ? c[0].mainsnak.datavalue.value : null; }
        var main = val("P18"), cat = val("P373");
        var first = main ? getJSON(C + "titles=" + encodeURIComponent("File:" + main)).then(function (r) { var pgs = r.query && r.query.pages; return usable(pgs && pgs[Object.keys(pgs)[0]]); }) : Promise.resolve(null);
        return first.then(function (img) {
          if (img || !cat) return img;
          return getJSON(C + "generator=categorymembers&gcmtype=file&gcmlimit=50&gcmsort=timestamp&gcmdir=desc&gcmtitle=" + encodeURIComponent("Category:" + cat)).then(function (r) {
            var list = Object.keys((r.query && r.query.pages) || {}).map(function (k) { return usable(r.query.pages[k]); })
              .filter(function (x) { return x && fold(x.title).indexOf(surname) >= 0; });
            list.sort(function (a, b) { return (b.year - a.year) || (b.tall - a.tall); });
            return list[0] || null;
          });
        });
      });
    });
  }
})();
