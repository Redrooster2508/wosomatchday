#!/usr/bin/env python3
"""Season forecasts: simulate every remaining fixture to get each team's chance of the title and
of each table zone (European places, relegation, knockout places), plus projected points.

Team strength comes from this season's goals for and against per game, relative to the league
average and shrunk toward average early in the season (the same "form" model the site uses),
with home advantage. Writes data/<league>/forecast.json.

Usage:
  python3 tools/build_forecast.py              # WSL, Liga F, Champions League league phase
  python3 tools/build_forecast.py eng.w.1      # one competition
"""
import json, math, os, random, sys, time, urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/"
CORE = "https://site.api.espn.com/apis/v2/sports/soccer/"
UA = "WomensMatchdayHub/1.0 (https://github.com/Redrooster2508/wosomatchday)"
SIMS = 10000
HOME, AWAY = 1.12, 0.9
SHRINK = 8        # games' worth of league-average form mixed into each rating, so early-season form isn't taken at face value
SPREAD = 0.15     # per-season uncertainty in each team's strength (log scale), so the forecast admits we don't know exactly how good teams are
# zones that the feed's table notes don't mark; ranks are 1-based and inclusive
ZONES = {
    "uefa.wchampions": [("Straight to quarter-finals", 1, 4), ("Knockout play-offs", 5, 12)],
}
LEAGUES = ["eng.w.1", "esp.w.1", "uefa.wchampions"]


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def poisson(lam, rnd=random.random):
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rnd()
        if p <= limit:
            return k
        k += 1


def build(slug):
    board = get(SITE + slug + "/scoreboard")
    season = board["leagues"][0].get("season") or {}
    start, end = season.get("startDate", ""), season.get("endDate", "9")
    now = datetime.now(timezone.utc)
    events = {}
    for year in range(int(start[:4]), int(end[:4]) + 1):
        if year > now.year + 1:
            break
        for ev in get(f"{SITE}{slug}/scoreboard?dates={year}&limit=1000").get("events", []):
            if start <= ev["date"] < end:
                events[ev["id"]] = ev
    st = get(CORE + slug + "/standings")
    entries = (st.get("children") or [{}])[0].get("standings", {}).get("entries", [])
    if not entries:
        print(f"{slug}: no table"); return
    teams, zones = {}, {}
    for e in entries:
        t, s = e["team"], {x["name"]: x.get("value", 0) for x in e.get("stats", [])}
        tid = str(t["id"])
        teams[tid] = {"id": tid, "name": (t.get("shortDisplayName") or t.get("displayName") or "").strip(), "abbr": t.get("abbreviation", ""),
                      "logo": (t.get("logos") or [{}])[0].get("href", ""), "pts": int(s.get("points", 0)), "gp": int(s.get("gamesPlayed", 0)),
                      "gd": int(s.get("pointDifferential", 0)), "gf": int(s.get("pointsFor", 0)), "ga": int(s.get("pointsAgainst", 0)), "rank": int(s.get("rank", 0))}
        note = e.get("note")
        if note and note.get("description"):
            z = zones.setdefault(note["description"], {"name": note["description"], "color": note.get("color", ""), "ranks": set()})
            z["ranks"].add(int(note.get("rank") or s.get("rank", 0)))
    for name, lo, hi in ZONES.get(slug, []):
        zones[name] = {"name": name, "color": "", "ranks": set(range(lo, hi + 1))}
    n = len(teams)
    # remaining fixtures between teams in the table
    remaining = []
    for ev in events.values():
        if ev["status"]["type"].get("completed") or ev["status"]["type"].get("state") == "post":
            continue
        cps = ev["competitions"][0]["competitors"]
        h = next((str(c["team"]["id"]) for c in cps if c["homeAway"] == "home"), None)
        a = next((str(c["team"]["id"]) for c in cps if c["homeAway"] == "away"), None)
        if h in teams and a in teams:
            remaining.append((h, a))
    # strength from season goals
    gp_all = sum(t["gp"] for t in teams.values()) or 1
    avg = (sum(t["gf"] for t in teams.values()) / gp_all) or 1.3
    def rating(t, key):
        if not t["gp"]:
            return 1.0
        raw, w = (t[key] / t["gp"]) / avg, t["gp"] / (t["gp"] + SHRINK)
        return 1 + (raw - 1) * w
    att = {k: rating(t, "gf") for k, t in teams.items()}
    dfn = {k: rating(t, "ga") for k, t in teams.items()}
    base = [(h, a, avg * att[h] * dfn[a] * HOME, avg * att[a] * dfn[h] * AWAY) for h, a in remaining]
    # simulate
    random.seed(20261106)
    finish = {k: [0] * n for k in teams}
    pts_sum = {k: 0 for k in teams}
    for _ in range(SIMS):
        # each simulated season draws its own team strengths around the estimate
        ka = {k: math.exp(random.gauss(0, SPREAD)) for k in teams}
        kd = {k: math.exp(random.gauss(0, SPREAD)) for k in teams}
        rates = [(h, a, lh * ka[h] * kd[a], la * ka[a] * kd[h]) for h, a, lh, la in base]
        pts = {k: t["pts"] for k, t in teams.items()}
        gd = {k: t["gd"] for k, t in teams.items()}
        gf = {k: t["gf"] for k, t in teams.items()}
        for h, a, lh, la in rates:
            x, y = poisson(lh), poisson(la)
            gd[h] += x - y; gd[a] += y - x; gf[h] += x; gf[a] += y
            if x > y: pts[h] += 3
            elif x < y: pts[a] += 3
            else: pts[h] += 1; pts[a] += 1
        order = sorted(teams, key=lambda k: (pts[k], gd[k], gf[k], random.random()), reverse=True)
        for pos, k in enumerate(order):
            finish[k][pos] += 1
            pts_sum[k] += pts[k]
    zl = [{"name": z["name"], "color": z["color"], "ranks": sorted(z["ranks"])} for z in sorted(zones.values(), key=lambda z: min(z["ranks"]))]
    out = []
    for k, t in teams.items():
        dist = [c / SIMS for c in finish[k]]
        out.append({**t, "proj": round(pts_sum[k] / SIMS, 1), "title": round(dist[0], 4), "dist": [round(p, 4) for p in dist],
                    "zones": {z["name"]: round(sum(dist[r - 1] for r in z["ranks"] if 0 < r <= n), 4) for z in zl}})
    out.sort(key=lambda t: (-t["title"], -t["proj"]))
    os.makedirs(os.path.join(DATA, slug), exist_ok=True)
    with open(os.path.join(DATA, slug, "forecast.json"), "w") as f:
        json.dump({"updated": now.strftime("%Y-%m-%dT%H:%MZ"), "sims": SIMS, "remaining": len(remaining), "played": sum(1 for e in events.values() if e["status"]["type"].get("completed")),
                   "season": season.get("displayName") or "", "zones": zl, "teams": out}, f, separators=(",", ":"), ensure_ascii=False)
    top = out[0]
    print(f"{slug}: {len(remaining)} fixtures left · predicted winner {top['name']} {top['title']:.0%} · next {out[1]['name']} {out[1]['title']:.0%}")


if __name__ == "__main__":
    for slug in (sys.argv[1:] or LEAGUES):
        build(slug)
