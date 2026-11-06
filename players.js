/* Player stats: the season table from data/<league>/players.json, each player's match log,
   and the line-ups with player stats in the match centre. */
(function (root) {
  "use strict";
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ESPN position codes grouped into the four lines of a team.
  function line(pos) {
    pos = String(pos || "").toUpperCase();
    if (pos === "G" || pos === "GK") return "GK";
    if (/^(CD|LB|RB|D|SW|WB|LWB|RWB)/.test(pos)) return "DF";
    if (/^(F|CF|ST|LW|RW|W|SS)/.test(pos)) return "FW";
    if (/M/.test(pos)) return "MF";
    return "";
  }

  var COLS = [
    { k: "apps", l: "Apps", t: "Appearances" }, { k: "starts", l: "Starts", t: "Starts" },
    { k: "G", l: "Goals", t: "Goals" }, { k: "A", l: "Assists", t: "Assists" },
    { k: "GA+", l: "G+A", t: "Goals plus assists", f: function (p) { return p.G + p.A; } },
    { k: "SHOT", l: "Shots", t: "Shots" }, { k: "SOG", l: "On target", t: "Shots on target" },
    { k: "min", l: "Min", t: "Minutes played", f: function (p) { return p.min || 0; }, opt: "min" },
    { k: "g90", l: "Goals/90", t: "Goals per 90 minutes (270+ minutes)", f: function (p) { return p.min >= 270 ? p.G / p.min * 90 : -1; }, dec: 2, opt: "min" },
    { k: "ga90", l: "G+A/90", t: "Goals plus assists per 90 minutes (270+ minutes)", f: function (p) { return p.min >= 270 ? (p.G + p.A) / p.min * 90 : -1; }, dec: 2, opt: "min" },
    { k: "pp", l: "Prog. passes", t: "Progressive passes attempted: ending at least 25% closer to goal, in the attacking half", f: function (p) { return p.pp || 0; }, opt: "min" },
    { k: "gpa", l: "Goals/app", t: "Goals per appearance", f: function (p) { return p.apps ? p.G / p.apps : 0; }, dec: 2 },
    { k: "SV", l: "Saves", t: "Saves" }, { k: "cs", l: "Clean sheets", t: "Clean sheets (goalkeepers who started)" },
    { k: "YC", l: "Yellow", t: "Yellow cards" }, { k: "RC", l: "Red", t: "Red cards" }
  ];
  function val(p, c) { return c.f ? c.f(p) : (p[c.k] || 0); }

  var cache = {};
  function load(slug, file, store) {
    if (!store[slug]) store[slug] = fetch("data/" + slug + "/" + file, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .catch(function (e) { delete store[slug]; throw e; });
    return store[slug];
  }

  var ui = { slug: null, q: "", team: "", pos: "", sort: "G", dir: -1, all: false, open: null };

  function mount(box, slug, api) {
    if (ui.slug !== slug) { ui = { slug: slug, q: "", team: "", pos: "", sort: "G", dir: -1, all: false, open: null }; }
    box.textContent = "";
    box.appendChild(el("p", "note", "Loading player stats…"));
    Promise.all([load(slug, "players.json", cache), fetch("data/" + slug + "/minutes.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })])
      .then(function (res) { if (ui.slug !== slug) return; res[0].minutes = res[1]; draw(box, res[0], api); })
      .catch(function () { if (ui.slug === slug) { box.textContent = ""; box.appendChild(el("p", "note", "Player stats for this competition haven't been built yet.")); } });
  }

  function draw(box, d, api) {
    box.textContent = "";
    var mins = d.minutes || null;
    var ps = d.players.map(function (p) {
      var t = d.teams[p.team] || {}, mm = mins && mins[p.id] || {};
      return Object.assign({ club: t.name || "", abbr: t.abbr || "", logo: t.logo || "", line: line(p.pos), min: mm.m || 0, pp: mm.pp || 0 }, p);
    });
    var cols = COLS.filter(function (c) { return !c.opt || mins; });
    // controls
    var bar = el("div", "pl-controls");
    var q = el("input"); q.type = "search"; q.id = "plSearch"; q.placeholder = "Search players"; q.value = ui.q; q.setAttribute("aria-label", "Search players");
    var team = el("select"); team.id = "plTeam"; team.className = "pl-select"; team.setAttribute("aria-label", "Club");
    team.appendChild(new Option("All clubs", ""));
    Object.keys(d.teams).map(function (id) { return [id, d.teams[id].name]; }).sort(function (a, b) { return a[1].localeCompare(b[1]); })
      .forEach(function (t) { team.appendChild(new Option(t[1], t[0])); });
    team.value = ui.team;
    var pos = el("div", "pl-pos"); pos.setAttribute("role", "group"); pos.setAttribute("aria-label", "Position");
    [["", "All"], ["GK", "GK"], ["DF", "DEF"], ["MF", "MID"], ["FW", "FWD"]].forEach(function (o) {
      var b = el("button", "pl-chip", o[1]); b.type = "button"; b.setAttribute("aria-pressed", String(ui.pos === o[0]));
      b.addEventListener("click", function () { ui.pos = o[0]; ui.all = false; draw(box, d, api); }); pos.appendChild(b);
    });
    bar.appendChild(q); bar.appendChild(team); bar.appendChild(pos);
    box.appendChild(bar);
    q.addEventListener("input", function () { ui.q = q.value; ui.all = false; renderRows(); });
    team.addEventListener("change", function () { ui.team = team.value; ui.all = false; renderRows(); });

    var wrap = el("div", "tbl-wrap"), table = el("table", "pl-table"), thead = el("thead"), hr = el("tr");
    hr.appendChild(el("th", "", "#"));
    hr.appendChild(el("th", "l", "Player"));
    hr.appendChild(el("th", "l", "Club"));
    cols.forEach(function (c) {
      var th = el("th"), b = el("button", "pl-sort", c.l); b.type = "button"; b.title = c.t;
      if (ui.sort === c.k) { th.setAttribute("aria-sort", ui.dir < 0 ? "descending" : "ascending"); b.textContent = c.l + (ui.dir < 0 ? " ↓" : " ↑"); }
      b.addEventListener("click", function () { if (ui.sort === c.k) ui.dir = -ui.dir; else { ui.sort = c.k; ui.dir = -1; } draw(box, d, api); });
      th.appendChild(b); hr.appendChild(th);
    });
    thead.appendChild(hr); table.appendChild(thead);
    var body = el("tbody"); table.appendChild(body); wrap.appendChild(table); box.appendChild(wrap);
    var more = el("button", "btn pl-more"); more.type = "button"; box.appendChild(more);
    var meta = el("p", "note pl-meta", "Built from " + d.matches + " finished matches · updated " + new Date(d.updated.replace("Z", ":00Z")).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
    box.appendChild(meta);

    function renderRows() {
      var col = cols.find(function (c) { return c.k === ui.sort; }) || cols[2];
      var needle = ui.q.trim().toLowerCase();
      var rows = ps.filter(function (p) {
        return (!ui.team || p.team === ui.team) && (!ui.pos || p.line === ui.pos) && (!needle || p.name.toLowerCase().indexOf(needle) >= 0 || p.club.toLowerCase().indexOf(needle) >= 0);
      }).sort(function (a, b) { return ui.dir * (val(a, col) - val(b, col)) || b.apps - a.apps || a.name.localeCompare(b.name); });
      body.textContent = "";
      var shown = ui.all ? rows : rows.slice(0, 25);
      shown.forEach(function (p, i) {
        var tr = el("tr", "pl-row"); tr.tabIndex = 0; tr.setAttribute("aria-label", p.name + ", " + p.club + ". Open player page");
        tr.appendChild(el("td", "", String(i + 1)));
        var nm = el("td", "l pl-name"); nm.appendChild(el("span", null, p.name)); nm.appendChild(el("span", "pl-pos-tag", (p.line || (p.pos === "SUB" ? "" : p.pos)) + (p.no ? " · #" + p.no : ""))); tr.appendChild(nm);
        var cl = el("td", "l"), ci = el("span", "tc"); if (p.logo) { var im = new Image(); im.src = p.logo; im.alt = ""; im.loading = "lazy"; ci.appendChild(im); } ci.appendChild(el("span", null, p.abbr || p.club)); cl.appendChild(ci); tr.appendChild(cl);
        cols.forEach(function (c) { var v = val(p, c); tr.appendChild(el("td", ui.sort === c.k ? "pl-sorted" : "", v < 0 ? "–" : c.dec ? v.toFixed(c.dec) : String(v))); });
        var href = "player.html?l=" + encodeURIComponent(ui.slug) + "&id=" + encodeURIComponent(p.id);
        nm.textContent = ""; var a = el("a", "pl-link", p.name); a.href = href; nm.appendChild(a); nm.appendChild(el("span", "pl-pos-tag", (p.line || (p.pos === "SUB" ? "" : p.pos)) + (p.no ? " · #" + p.no : "")));
        tr.addEventListener("click", function (e) { if (e.target.closest("a")) return; location.href = href; });
        tr.addEventListener("keydown", function (e) { if (e.key === "Enter") location.href = href; });
        body.appendChild(tr);
      });
      if (!rows.length) { var tr = el("tr"), td = el("td", "l note", "No players match."); td.colSpan = 3 + cols.length; tr.appendChild(td); body.appendChild(tr); }
      more.hidden = rows.length <= 25;
      more.textContent = ui.all ? "Show top 25" : "Show all " + rows.length + " players";
      more.onclick = function () { ui.all = !ui.all; renderRows(); };
    }
    renderRows();
  }

  // Line-ups for one match from its summary: starters, then substitutes who came on, each with their line.
  function lineups(box, summary, match, slug) {
    box.textContent = "";
    var rosters = summary && summary.rosters || [];
    var played = rosters.some(function (r) { return (r.roster || []).some(function (p) { return p.starter; }); });
    if (!played) { box.appendChild(el("p", "note", match.state === "pre" ? "Line-ups usually appear about an hour before kick-off." : "No line-ups in the feed for this match.")); return; }
    var grid = el("div", "lu-grid");
    ["home", "away"].forEach(function (side) {
      var team = match[side], r = rosters.find(function (x) { return x.team && String(x.team.id) === team.id; });
      var col = el("div", "lu-col " + side);
      var h = el("div", "lu-head"); h.appendChild(el("b", null, team.name)); h.appendChild(el("span", "eyebrow", r && r.formation ? r.formation : "")); col.appendChild(h);
      if (!r) { col.appendChild(el("p", "note", "No line-up yet.")); grid.appendChild(col); return; }
      function group(title, list) {
        if (!list.length) return;
        col.appendChild(el("div", "eyebrow lu-group", title));
        list.forEach(function (p) {
          var st = {}; (p.stats || []).forEach(function (x) { st[x.abbreviation] = x.value || 0; });
          var row = el("div", "lu-row");
          row.appendChild(el("span", "lu-no num", p.jersey || ""));
          var nm = el("span", "lu-name"), who = (p.athlete && p.athlete.displayName) || "";
          if (slug && p.athlete && p.athlete.id) { var a = el("a", "pl-link", who); a.href = "player.html?l=" + encodeURIComponent(slug) + "&id=" + encodeURIComponent(p.athlete.id); nm.appendChild(a); }
          else nm.appendChild(el("span", null, who));
          nm.appendChild(el("span", "lu-pos", (p.position && p.position.abbreviation) || "")); row.appendChild(nm);
          var marks = el("span", "lu-marks");
          for (var i = 0; i < st.G; i++) marks.appendChild(el("span", "ball", ""));
          if (st.A) marks.appendChild(el("span", "lu-a", "A" + (st.A > 1 ? "×" + st.A : "")));
          for (var y = 0; y < st.YC; y++) marks.appendChild(el("span", "bk-card y", ""));
          for (var z = 0; z < st.RC; z++) marks.appendChild(el("span", "bk-card r", ""));
          if (p.subbedOut) marks.appendChild(el("span", "lu-off", "off"));
          if (p.subbedIn && !p.starter) marks.appendChild(el("span", "lu-on", "on"));
          row.appendChild(marks);
          var line2 = [];
          function n(v, one, many) { return v + " " + (v === 1 ? one : many); }
          if (st.SHOT) line2.push(n(st.SHOT, "shot", "shots") + (st.SOG ? " (" + st.SOG + " on target)" : ""));
          if (st.SV) line2.push(n(st.SV, "save", "saves"));
          if (st.FC) line2.push(n(st.FC, "foul", "fouls"));
          row.appendChild(el("span", "lu-stats num", line2.join(" · ")));
          col.appendChild(row);
        });
      }
      var list = r.roster || [];
      group("Starting XI", list.filter(function (p) { return p.starter; }).sort(function (a, b) { return (a.formationPlace || 99) - (b.formationPlace || 99); }));
      group("Came on", list.filter(function (p) { return !p.starter && p.subbedIn; }));
      grid.appendChild(col);
    });
    box.appendChild(grid);
  }

  root.Players = { mount: mount, lineups: lineups };
})(this);
