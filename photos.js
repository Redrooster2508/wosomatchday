/* Team photos: an illustrated squad line-up in the club's colours, or a photo the viewer uploads. */
(function (root) {
  "use strict";
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function hex(c, fallback) { c = String(c || "").replace("#", ""); return /^[0-9a-f]{6}$/i.test(c) ? "#" + c : fallback; }
  function lum(c) { var n = parseInt(c.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  var SKIN = ["#5C3A21", "#8D5524", "#A86B3C", "#C68642", "#E0AC69", "#F1C27D", "#FFDBAC", "#6B3E26"];
  var HAIR = ["#1A1209", "#2B1D12", "#4A2E19", "#7A4A23", "#B7813F", "#D9B36C", "#141414"];
  var GK = ["#E6E04A", "#2EBF6E", "#F07B2C", "#4CC3E8", "#9A4FD1", "#E8432E"];

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }

  function shirt(c, k, x, y, w, h, gk) {
    c.save(); rr(c, x, y, w, h, 10); c.clip();
    c.fillStyle = gk ? k.gk : k.c1; c.fillRect(x, y, w, h);
    c.fillStyle = "rgba(0,0,0,.12)"; c.fillRect(x + w * 0.7, y, w * 0.3, h);
    c.restore();
    c.fillStyle = gk ? "#222" : k.c2; c.beginPath(); c.moveTo(x + w / 2 - 9, y); c.lineTo(x + w / 2, y + 10); c.lineTo(x + w / 2 + 9, y); c.closePath(); c.fill();
  }
  // A women's squad: ponytails, top knots, long hair, braids and curls, with hair ties in the second kit colour.
  // Hair behind the head and shoulders is drawn before the body, the face and hairline after it.
  var STYLES = ["ponytail", "long", "topknot", "braids", "curls", "ponytail", "bob"];
  function look(r) { return { skin: pick(r, SKIN), hair: pick(r, HAIR), style: pick(r, STYLES), side: r() < 0.5 ? -1 : 1 }; }
  function hairBack(c, h, x, y, rad) {
    c.fillStyle = h.hair;
    if (h.style === "long") { rr(c, x - rad * 1.2, y - rad * 0.4, rad * 2.4, rad * 3.1, rad); c.fill(); }
    if (h.style === "bob") { rr(c, x - rad * 1.2, y - rad * 0.6, rad * 2.4, rad * 2.0, rad * 0.8); c.fill(); }
    if (h.style === "curls") for (var i = 0; i < 9; i++) { var an = Math.PI * (0.85 + i * 0.165); c.beginPath(); c.arc(x + Math.cos(an) * rad * 1.05, y - rad * 0.05 + Math.sin(an) * rad * 1.05, rad * 0.5, 0, Math.PI * 2); c.fill(); }
    if (h.style === "braids") for (var j = 0; j < 5; j++) { c.beginPath(); c.arc(x - rad * 0.95, y + rad * (0.4 + j * 0.42), rad * 0.24, 0, Math.PI * 2); c.arc(x + rad * 0.95, y + rad * (0.4 + j * 0.42), rad * 0.24, 0, Math.PI * 2); c.fill(); }
  }
  function head(c, h, k, x, y, rad) {
    if (h.style === "ponytail") { c.fillStyle = h.hair; c.beginPath(); c.ellipse(x + h.side * rad * 1.05, y + rad * 0.95, rad * 0.38, rad * 1.25, -h.side * 0.3, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = h.skin; c.fillRect(x - rad * 0.32, y + rad * 0.7, rad * 0.64, rad * 0.7);
    c.beginPath(); c.ellipse(x, y, rad * 0.88, rad, 0, 0, Math.PI * 2); c.fill();
    // hairline: pulled back over the top and down the sides to the ears
    c.fillStyle = h.hair; c.beginPath(); c.arc(x, y - rad * 0.08, rad * 0.98, Math.PI * 0.93, Math.PI * 2.07); c.fill();
    if (h.style === "long" || h.style === "bob") {        // side locks framing the face
      rr(c, x - rad * 1.0, y - rad * 0.3, rad * 0.36, rad * (h.style === "long" ? 2.6 : 1.3), rad * 0.18); c.fill();
      rr(c, x + rad * 0.64, y - rad * 0.3, rad * 0.36, rad * (h.style === "long" ? 2.6 : 1.3), rad * 0.18); c.fill();
    }
    if (h.style === "topknot") { c.beginPath(); c.arc(x, y - rad * 1.12, rad * 0.5, 0, Math.PI * 2); c.fill(); c.fillStyle = k.c2; c.fillRect(x - rad * 0.32, y - rad * 0.78, rad * 0.64, rad * 0.16); }
    if (h.style === "ponytail") { c.fillStyle = k.c2; c.beginPath(); c.arc(x + h.side * rad * 0.9, y - rad * 0.1, rad * 0.16, 0, Math.PI * 2); c.fill(); }
    // face
    c.fillStyle = "#24170F";
    c.beginPath(); c.arc(x - rad * 0.32, y + rad * 0.12, rad * 0.1, 0, Math.PI * 2); c.arc(x + rad * 0.32, y + rad * 0.12, rad * 0.1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(60,20,20,.75)"; c.lineWidth = Math.max(1.4, rad * 0.09); c.lineCap = "round";
    c.beginPath(); c.arc(x, y + rad * 0.36, rad * 0.24, Math.PI * 0.2, Math.PI * 0.8); c.stroke();
  }
  function standing(c, r, k, x, feet, gk) {
    var top = feet - 196, h = look(r), skin = h.skin;
    c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.ellipse(x, feet + 2, 34, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = skin; rr(c, x - 34, top + 44, 12, 66, 6); c.fill(); rr(c, x + 22, top + 44, 12, 66, 6); c.fill();
    c.fillStyle = k.sh; rr(c, x - 27, top + 110, 54, 32, 6); c.fill();
    c.fillStyle = skin; c.fillRect(x - 20, top + 140, 14, 22); c.fillRect(x + 6, top + 140, 14, 22);
    c.fillStyle = k.so; rr(c, x - 21, top + 158, 16, 30, 4); c.fill(); rr(c, x + 5, top + 158, 16, 30, 4); c.fill();
    c.fillStyle = "#111"; rr(c, x - 23, top + 186, 20, 10, 4); c.fill(); rr(c, x + 3, top + 186, 20, 10, 4); c.fill();
    hairBack(c, h, x, top + 20, 17);
    shirt(c, k, x - 28, top + 38, 56, 78, gk);
    c.fillStyle = gk ? k.gk : k.c1; rr(c, x - 38, top + 40, 14, 24, 6); c.fill(); rr(c, x + 24, top + 40, 14, 24, 6); c.fill();
    if (gk) { c.fillStyle = "#EEE"; c.beginPath(); c.arc(x - 28, top + 110, 8, 0, Math.PI * 2); c.arc(x + 28, top + 110, 8, 0, Math.PI * 2); c.fill(); }
    head(c, h, k, x, top + 20, 17);
  }
  function crouching(c, r, k, x, feet, cap) {
    var top = feet - 150, h = look(r), skin = h.skin;
    c.fillStyle = "rgba(0,0,0,.28)"; c.beginPath(); c.ellipse(x, feet + 2, 44, 7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = k.so; rr(c, x - 36, feet - 46, 16, 40, 5); c.fill(); rr(c, x + 20, feet - 46, 16, 40, 5); c.fill();
    c.fillStyle = "#111"; rr(c, x - 40, feet - 10, 22, 11, 4); c.fill(); rr(c, x + 18, feet - 10, 22, 11, 4); c.fill();
    c.fillStyle = skin; c.beginPath(); c.arc(x - 28, feet - 52, 12, 0, Math.PI * 2); c.arc(x + 28, feet - 52, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = k.sh; rr(c, x - 36, feet - 72, 72, 26, 8); c.fill();
    hairBack(c, h, x, top + 20, 18);
    shirt(c, k, x - 29, top + 38, 58, 66, false);
    c.fillStyle = k.c1; rr(c, x - 40, top + 40, 14, 22, 6); c.fill(); rr(c, x + 26, top + 40, 14, 22, 6); c.fill();
    c.fillStyle = skin; rr(c, x - 38, top + 58, 11, 40, 5); c.fill(); rr(c, x + 27, top + 58, 11, 40, 5); c.fill();
    if (cap) { c.fillStyle = "#F2C230"; c.fillRect(x - 40, top + 50, 14, 6); }
    head(c, h, k, x, top + 20, 18);
  }

  // team: {id, color, alternateColor}
  function drawSquad(team) {
    var W = 640, H = 400, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var c = cv.getContext("2d"), r = rng(hashStr(String(team.id) + "photo"));
    var c1 = hex(team.color, "#334455"), c2 = hex(team.alternateColor, "#FFFFFF");
    if (c1.toLowerCase() === c2.toLowerCase()) c2 = lum(c1) > 0.5 ? "#141414" : "#FFFFFF";
    var k = { c1: c1, c2: c2, sh: lum(c1) > 0.85 ? c2 : c1, so: c1, gk: pick(r, GK) };
    var g = c.createLinearGradient(0, 0, 0, 175); g.addColorStop(0, "#1E2733"); g.addColorStop(1, "#38475A"); c.fillStyle = g; c.fillRect(0, 0, W, 175);
    for (var row = 0; row < 9; row++) for (var i = 0; i < 64; i++) {
      c.fillStyle = "hsla(" + Math.floor(r() * 360) + ",30%," + (45 + r() * 30) + "%," + (0.35 + r() * 0.3) + ")";
      c.beginPath(); c.arc(i * 10 + (row % 2) * 5 + r() * 3, 14 + row * 17 + r() * 3, 3.2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = c1; c.fillRect(0, 168, W, 26); c.fillStyle = c2; c.fillRect(0, 178, W, 5);
    for (var b = 0; b < 8; b++) { c.fillStyle = b % 2 ? "#2F7A44" : "#38894E"; c.fillRect(0, 194 + b * 26, W, 26); }
    var gkPos = Math.floor(r() * 2) + 2;
    [86, 176, 266, 356, 446, 536].forEach(function (x, n) { standing(c, r, k, x + 18, 318, n === gkPos); });
    [110, 200, 290, 380, 470, 560].forEach(function (x, n) { crouching(c, r, k, x - 14, 392, n === 2); });
    c.fillStyle = "#FAFAFA"; c.beginPath(); c.arc(W / 2 + 4, 382, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#222"; c.beginPath();
    for (var p = 0; p < 5; p++) { var an = -Math.PI / 2 + p * 2 * Math.PI / 5; c.lineTo(W / 2 + 4 + Math.cos(an) * 6, 382 + Math.sin(an) * 6); }
    c.fill();
    var vg = c.createRadialGradient(W / 2, H * 0.55, 80, W / 2, H * 0.55, 420); vg.addColorStop(0, "rgba(255,255,255,.06)"); vg.addColorStop(1, "rgba(0,0,0,.35)");
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    return cv.toDataURL("image/jpeg", 0.86);
  }

  var cache = {}, uploads = {}, shared = {}, credits = {};
  function key(id) { return "wmh-photo-" + id; }
  function stored(id) { if (uploads[id]) return uploads[id]; try { return localStorage.getItem(key(id)); } catch (e) { return null; } }
  var Photos = {
    // photos/manifest.json maps ESPN team id to {file, credit, source} in photos/; those photos show for every visitor.
    loadShared: function () {
      return fetch("photos/manifest.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (m) {
          Object.keys(m || {}).forEach(function (id) {
            var e = typeof m[id] === "string" ? { file: m[id] } : m[id];
            if (!e || typeof e.file !== "string" || /^[a-z]+:|\.\.|\//i.test(e.file)) return;
            shared[id] = "photos/" + e.file;
            if (e.credit) credits[id] = { text: String(e.credit), source: /^https:\/\/[^\s"<>]+$/.test(e.source || "") ? e.source : "" };
          });
        })
        .catch(function () {});
    },
    // Credit for the shared photo, when that is the one showing.
    credit: function (id) { return stored(id) ? null : credits[id] || null; },
    // Order: this browser's upload, then the site's shared photo, then the illustration.
    get: function (team) { var s = stored(team.id) || shared[team.id]; if (s) return s; if (!cache[team.id]) cache[team.id] = drawSquad(team); return cache[team.id]; },
    isPhoto: function (id) { return !!(stored(id) || shared[id]); },
    hasUpload: function (id) { return !!stored(id); },
    clear: function (id) { delete uploads[id]; try { localStorage.removeItem(key(id)); } catch (e) {} },
    // Downscale to at most 960px and keep as JPEG; falls back to this visit only if storage is full or blocked.
    upload: function (id, file, done) {
      var rd = new FileReader();
      rd.onload = function () {
        var im = new Image();
        im.onload = function () {
          var sc = Math.min(1, 960 / Math.max(im.width, im.height)), cv = document.createElement("canvas");
          cv.width = Math.round(im.width * sc); cv.height = Math.round(im.height * sc);
          cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
          var url = cv.toDataURL("image/jpeg", 0.84), saved = true;
          uploads[id] = url;
          try { localStorage.setItem(key(id), url); } catch (e) { saved = false; }
          done(saved);
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(file);
    }
  };
  root.Photos = Photos;
})(this);
