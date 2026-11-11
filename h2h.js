/* Head to head: league meetings between two teams over recent seasons, from ESPN team schedules. */
(function (root) {
  "use strict";
  var SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/";
  var cache = {};
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // All finished meetings between teamId and oppId in this competition, newest first.
  function load(slug, teamId, oppId, seasons) {
    var key = slug + ":" + teamId;
    if (!cache[key]) {
      var y = new Date().getFullYear(), years = [];
      for (var i = 0; i < (seasons || 5); i++) years.push(y - i);
      cache[key] = Promise.all(years.map(function (yr) {
        return fetch(SITE + slug + "/teams/" + teamId + "/schedule?season=" + yr).then(function (r) { return r.ok ? r.json() : { events: [] }; }).catch(function () { return { events: [] }; });
      })).then(function (res) {
        var seen = {}, all = [];
        res.forEach(function (d) { (d.events || []).forEach(function (ev) { if (!seen[ev.id]) { seen[ev.id] = 1; all.push(ev); } }); });
        return all;
      });
    }
    return cache[key].then(function (all) {
      return all.filter(function (ev) {
        var c = ev.competitions && ev.competitions[0], st = c && c.status && c.status.type || ev.status && ev.status.type || {};
        if (!c || !st.completed) return false;
        var ids = (c.competitors || []).map(function (x) { return String(x.team && x.team.id || x.id); });
        return ids.indexOf(String(teamId)) >= 0 && ids.indexOf(String(oppId)) >= 0;
      }).map(function (ev) {
        var c = ev.competitions[0], h = c.competitors.find(function (x) { return x.homeAway === "home"; }), a = c.competitors.find(function (x) { return x.homeAway === "away"; });
        function score(x) { var s = x.score; return s == null ? 0 : typeof s === "object" ? +(s.value != null ? s.value : s.displayValue) || 0 : +s || 0; }
        function name(x) { return (x.team && (x.team.shortDisplayName || x.team.displayName)) || ""; }
        return { id: ev.id, date: ev.date, home: String(h.team.id), away: String(a.team.id), hn: name(h), an: name(a), hs: score(h), as: score(a) };
      }).sort(function (x, y) { return new Date(y.date) - new Date(x.date); });
    });
  }

  // Summary from teamId's side, then the list. A meeting with a label (its competition) shows it under the date, in the colour class `cls`.
  function render(box, meetings, teamId, teamName, oppName) {
    box.textContent = "";
    if (!meetings.length) { box.appendChild(el("p", "note", "No meetings between " + teamName + " and " + oppName + " in the last five seasons.")); return; }
    var w = 0, d = 0, l = 0, gf = 0, ga = 0;
    meetings.forEach(function (m) {
      var mine = m.home === String(teamId), f = mine ? m.hs : m.as, a = mine ? m.as : m.hs;
      gf += f; ga += a; if (f > a) w++; else if (f < a) l++; else d++;
    });
    var sum = el("div", "h2h-sum");
    [[teamName + " wins", w], ["Draws", d], [oppName + " wins", l]].forEach(function (x) { var t = el("div", "pl-tile"); t.appendChild(el("b", "num", String(x[1]))); t.appendChild(el("span", null, x[0])); sum.appendChild(t); });
    box.appendChild(sum);
    var bar = el("div", "pbar lg h2h-bar");
    [["ph", w], ["pd", d], ["pa", l]].forEach(function (x) { var i = el("i", x[0]); i.style.flex = x[1] + " 0 0"; bar.appendChild(i); });
    box.appendChild(bar);
    box.appendChild(el("p", "note", meetings.length + " meetings · goals " + gf + "–" + ga));
    var t = el("table", "h2h-table"), tb = el("tbody");
    meetings.forEach(function (m) {
      var tr = el("tr", m.cls || null);
      var dt = el("td", "l", new Date(m.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }));
      if (m.label) { var lc = el("div", "fx-comp"); lc.appendChild(el("span", "chip " + (m.cls || ""), m.label)); dt.appendChild(lc); }   // set by team pages covering several competitions
      tr.appendChild(dt);
      tr.appendChild(el("td", "l", m.hn));
      tr.appendChild(el("td", "h2h-score num", m.hs + "–" + m.as));
      tr.appendChild(el("td", "l", m.an));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    var wrap = el("div", "tbl-wrap"); wrap.appendChild(t); box.appendChild(wrap);
  }

  root.H2H = { load: load, render: render };
})(this);
