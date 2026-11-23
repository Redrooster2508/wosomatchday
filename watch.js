/* Where to watch a match: the competition's broadcasters in the viewer's region (broadcasters.json, researched by
   hand), plus ESPN's own listing for the match, which covers the United States only. The region is guessed from the
   browser's time zone, then language, and can be changed; the choice is remembered in this browser. */
(function (root) {
  "use strict";
  var data = null, loading = null;
  // time zones that place a viewer in one of the listed regions (America/ zones default to the United States)
  var ZONES = { "Europe/London": "GB", "Europe/Belfast": "GB", "Europe/Dublin": "IE", "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Africa/Ceuta": "ES",
    "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Busingen": "DE", "Asia/Shanghai": "CN", "Asia/Chongqing": "CN", "Asia/Harbin": "CN", "Asia/Urumqi": "CN",
    "Asia/Hong_Kong": "HK" };
  var CANADA = /^America\/(Toronto|Montreal|Vancouver|Edmonton|Calgary|Winnipeg|Regina|Halifax|St_Johns|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Yellowknife|Iqaluit|Dawson_Creek|Fort_Nelson|Swift_Current|Rankin_Inlet|Resolute|Cambridge_Bay|Inuvik|Atikokan|Creston|Nipigon|Thunder_Bay|Rainy_River|Pangnirtung|Dawson)$/;
  var US = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak|Boise|Detroit|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu)$/;
  // ESPN's short names in its listings
  var LONG = { "USA Net": "USA Network", "Tele": "Telemundo" };
  var THE = { GB: 1, US: 1 };   // "in the United Kingdom"
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function load() {
    if (data) return Promise.resolve(data);
    if (!loading) loading = fetch("broadcasters.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) { data = d; return d; }).catch(function () { loading = null; return null; });
    return loading;
  }
  function guess(regions) {
    var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var r = ZONES[tz] || (/^Australia\//.test(tz) ? "AU" : CANADA.test(tz) ? "CA" : US.test(tz) ? "US" : "");
    // the language only when the time zone says nothing about the place (en-US is many browsers' default everywhere)
    if (!r && (!tz || /^(UTC|GMT|Etc\/)/.test(tz))) (navigator.languages || [navigator.language || ""]).some(function (l) { var m = /-([A-Z]{2})$/i.exec(l || ""); if (m && regions[m[1].toUpperCase()]) { r = m[1].toUpperCase(); return true; } });
    if (r === "UK") r = "GB";
    return regions[r] ? r : "XX";
  }

  // The listing ESPN gives with the match (scoreboard geoBroadcasts or broadcasts): [{name, kind}], United States
  function fromEvent(c) {
    var out = [], seen = {};
    function add(n, kind) { n = LONG[n] || n; if (n && !seen[n]) { seen[n] = 1; out.push({ name: n, kind: kind }); } }
    (c.geoBroadcasts || []).forEach(function (b) {
      if (b.region && String(b.region).toLowerCase() !== "us") return;
      add(b.media && (b.media.shortName || b.media.name), b.type && /stream/i.test(b.type.shortName || "") ? "Streaming" : "TV");
    });
    if (!out.length) (c.broadcasts || []).forEach(function (b) { (b.names || []).forEach(function (n) { add(n, ""); }); });
    return out;
  }

  // box: the panel's body; pick: its <select>; ctx: {slug, match: {tv, state}, key: storage key for the region}
  function render(box, pick, ctx) {
    load().then(function (d) {
      box.textContent = "";
      if (!d) { box.appendChild(el("p", "note", "The broadcaster list didn't load. Try again later.")); pick.parentNode.hidden = true; return; }
      var regions = d.regions, region = store(ctx.key) || guess(regions);
      if (!regions[region] && region !== "XX") region = "XX";
      if (!pick.options.length) {
        Object.keys(regions).forEach(function (k) { pick.appendChild(new Option(regions[k], k)); });
        pick.appendChild(new Option("Elsewhere", "XX"));
      }
      pick.parentNode.hidden = false;
      pick.value = region;
      pick.onchange = function () { store(ctx.key, pick.value); render(box, pick, ctx); };
      var comp = d.competitions[ctx.slug], where = region === "XX" ? "your region" : (THE[region] ? "the " : "") + regions[region];

      // this match, from ESPN (United States)
      var tv = ctx.match.tv || [];
      if (region === "US" && tv.length) {
        var g = el("div", "watch-game");
        g.appendChild(el("span", "eyebrow", ctx.match.state === "post" ? "This match was on" : "This match"));
        var ul = el("ul", "watch");
        tv.forEach(function (t) { var li = el("li"); li.appendChild(el("b", null, t.name)); if (t.kind) li.appendChild(el("span", null, t.kind)); ul.appendChild(li); });
        g.appendChild(ul); box.appendChild(g);
      }
      if (!comp) {
        box.appendChild(el("p", "note", "International matches are sold by the home team's federation, so the broadcaster differs from match to match. " +
          (region === "US" && tv.length ? "The listing above is ESPN's." : "Check your local TV listings.")));
        return;
      }
      var list = region !== "XX" && comp.regions[region], extra = comp.elsewhere || [];
      if (region === "US" && tv.length && list) box.appendChild(el("span", "eyebrow watch-sub", comp.name + " in the United States"));
      var items = list || extra;
      if (!list && extra.length) box.appendChild(el("span", "eyebrow watch-sub", "Where there's no local broadcaster"));
      if (items.length) {
        var ul2 = el("ul", "watch");
        items.forEach(function (x) { var li = el("li"); li.appendChild(el("b", null, x[0])); if (x[1]) li.appendChild(el("span", null, x[1])); ul2.appendChild(li); });
        box.appendChild(ul2);
      }
      var note = el("p", "note watch-note");
      if (list) note.appendChild(document.createTextNode(comp.name + " broadcasters in " + where + ", " + comp.season + " season. Not every match is shown live, so check the broadcaster's schedule. "));
      else note.appendChild(document.createTextNode((region === "XX" ? "Only the regions in the menu are listed here. " : "No broadcaster found for " + where + ". ") + (comp.none ? comp.none + " " : "")));
      var a = el("a", null, "Official list"); a.href = comp.official; a.target = "_blank"; a.rel = "noopener"; note.appendChild(a);
      note.appendChild(document.createTextNode(" · checked " + new Date(d.updated + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })));
      box.appendChild(note);
    });
  }

  root.Watch = { load: load, fromEvent: fromEvent, render: render };
})(this);
