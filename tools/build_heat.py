#!/usr/bin/env python3
"""Build season heatmaps and shot maps per player from ESPN play-by-play.

Run after tools/build_players.py: it takes the season's finished matches from
data/<league>/matches.json, reads each match's play-by-play once, and writes
data/<league>/heat.json:

  {"v": 3, "grid": [24, 16], "done": [match ids], "players": {id: {"n": touches, "c": {cell: count},
   "s": [[x, y, kind, opponent, date, goalY, goalZ], ...],      shots, with where they crossed the goal line
   "p": passes, "pp": progressive passes, "pl": [[x, y, x2, y2], ...] (progressive passes, newest 120),
   "m": minutes, "mm": {match id: minutes}}}}

A pass is progressive when it moves the ball at least 25% closer to the opponent's goal and ends
in the attacking half. ESPN doesn't say whether a pass was completed, so these are attempts.
Minutes come from the starting XI (matches.json), substitutions and red cards in the play-by-play.

Cells count touches on a 24 x 16 grid in the player's attacking direction (x along the pitch).
Shot kinds: goal, on (saved), off, blocked. Only matches not in "done" are read.

Usage:
  python3 tools/build_heat.py                 # all competitions
  python3 tools/build_heat.py eng.w.1         # one competition
  python3 tools/build_heat.py --rebuild       # read every match again
"""
import gzip, json, math, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/"
LEAGUES = ["eng.w.1", "esp.w.1", "usa.nwsl", "uefa.wchampions",
           # national teams
           "fifa.friendly.w", "fifa.wwcq.ply", "concacaf.womens.championship", "caf.w.nations", "afc.w.asian.cup",
           "fifa.wwc", "uefa.weuro", "conmebol.america.femenina", "fifa.w.olympics", "uefa.w.nations",
           # men's national teams, for their team and player pages
           "fifa.friendly", "fifa.world", "uefa.nations", "concacaf.nations.league", "caf.nations_qual", "caf.nations"]
UA = "WomensMatchdayHub/1.0 (https://github.com/Redrooster2508/wosomatchday)"
GX, GY = 24, 16
VERSION = 3  # 3: corners and out-of-play passes no longer count as progressive
SKIP = re.compile(r"^(Substitution|Start Delay|End Delay|Halftime|Start 2nd Half|End Regular Time|Kickoff|Out|Corner Awarded|Drop of Ball|Assist|Assists Shot|End Extra Time|Start Extra Time)$", re.I)


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                return json.loads(raw)
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def shot_kind(t):
    if re.search(r"own goal", t, re.I):
        return None
    if re.match(r"^Goal($| - )", t, re.I):  # not "Goal Kick"
        return "goal"
    if re.match(r"^(Shot On Target|Penalty - Saved)$", t, re.I):
        return "on"
    if re.match(r"^Shot Blocked$", t, re.I):
        return "blocked"
    if re.match(r"^(Shot Off Target|Penalty - Missed)$", t, re.I) or re.search(r"woodwork|post", t, re.I):
        return "off"
    return None


def ref_id(ref, kind):
    m = re.search(kind + r"/(\d+)", ref or "")
    return m.group(1) if m else None


def plays(slug, mid):
    first = get(f"{CORE}{slug}/events/{mid}/competitions/{mid}/plays?limit=1000&page=1")
    pages = [first] + [get(f"{CORE}{slug}/events/{mid}/competitions/{mid}/plays?limit=1000&page={n}") for n in range(2, (first.get("pageCount") or 1) + 1)]
    out, events = [], []
    for pg in pages:
        for p in pg.get("items", []):
            t = (p.get("type") or {}).get("text", "")
            period = (p.get("period") or {}).get("number") or 1
            minute = min(90 if period <= 2 else 120, (p.get("clock") or {}).get("value", 0) / 60)
            # substitutions and red cards, for minutes played
            if t == "Substitution" or re.search(r"red card", t, re.I):
                for part in p.get("participants") or []:
                    aid = ref_id((part.get("athlete") or {}).get("$ref"), "athletes")
                    if aid:
                        events.append((aid, part.get("type") or ("sent-off" if "red" in t.lower() else ""), minute, period))
            if p.get("fieldPositionX") is None or SKIP.match(t):
                continue
            part = (p.get("participants") or [{}])[0]
            ath = ref_id((part.get("athlete") or {}).get("$ref"), "athletes")
            if ath:
                out.append({"ath": ath, "team": ref_id((p.get("team") or {}).get("$ref"), "teams"), "x": float(p["fieldPositionX"]), "y": float(p["fieldPositionY"]),
                            "x2": p.get("fieldPosition2X"), "y2": p.get("fieldPosition2Y"), "type": t, "shot": shot_kind(t),
                            "gy": p.get("goalPositionY"), "gz": p.get("goalPositionZ")})
    return {"plays": out, "events": events}


def dist_to_goal(x, y):
    """Distance in metres from a spot (feed coordinates) to the middle of the opponent's goal."""
    return math.hypot((100 - x) * 1.05, (50 - y) * 0.68)


def safe(slug, mid):
    try:
        return plays(slug, mid)
    except Exception as e:
        print(f"  skipped {mid}: {e}", flush=True)
        return None


def build(slug, rebuild=False):
    folder = os.path.join(DATA, slug)
    mfile, hfile = os.path.join(folder, "matches.json"), os.path.join(folder, "heat.json")
    if not os.path.exists(mfile):
        print(f"{slug}: run tools/build_players.py first"); return
    matches = json.load(open(mfile))["matches"]
    heat = {"v": VERSION, "grid": [GX, GY], "done": [], "players": {}}
    if not rebuild and os.path.exists(hfile):
        old = json.load(open(hfile))
        if old.get("v") == VERSION:
            heat = old  # older files lack passes, goal-mouth spots and minutes: read every match again
    done = set(heat["done"]) & set(matches)  # matches dropped from the season are forgotten on --rebuild
    todo = [m for m in matches if m not in done]
    print(f"{slug}: {len(matches)} matches, {len(todo)} new", flush=True)
    if not todo and os.path.exists(hfile):
        print("  nothing new; file left as it is"); return
    with ThreadPoolExecutor(6) as pool:
        for mid, res in zip(todo, pool.map(lambda m: safe(slug, m), todo)):
            if res is None:
                continue
            m = matches[mid]
            when = datetime.fromisoformat(m["date"].replace("Z", "+00:00")).strftime("%-d %b")
            def player(a):
                return heat["players"].setdefault(a, {"n": 0, "c": {}, "s": [], "p": 0, "pp": 0, "pl": [], "m": 0, "mm": {}})
            for e in res["plays"]:
                p = player(e["ath"])
                x, y = e["x"], e["y"]
                cell = str(min(GY - 1, int(y / 100 * GY)) * GX + min(GX - 1, int(x / 100 * GX)))
                p["c"][cell] = p["c"].get(cell, 0) + 1
                p["n"] += 1
                if e["shot"]:
                    opp = m["teams"].get(m["away"] if e["team"] == m["home"] else m["home"], {}).get("name", "")
                    gy = round(float(e["gy"]), 1) if e["gy"] is not None else None
                    gz = round(float(e["gz"]), 1) if e["gz"] is not None else None
                    p["s"].append([round(x, 1), round(y, 1), e["shot"], opp, when, gy, gz])
                if e["type"] in ("Pass", "Cross") and e["x2"] is not None:
                    p["p"] += 1
                    x2, y2 = float(e["x2"]), float(e["y2"])
                    before, after = dist_to_goal(x, y), dist_to_goal(x2, y2)
                    # corners start on the goal line, and passes "ending" there mostly went out of play
                    if x < 99 and 50 <= x2 < 99 and after <= 0.75 * before:
                        p["pp"] += 1
                        p["pl"] = (p["pl"] + [[round(x, 1), round(y, 1), round(x2, 1), round(y2, 1)]])[-120:]
            # minutes: starters from the match sheet, then substitutions and red cards
            end = 120 if any(ev[3] >= 3 for ev in res["events"]) else 90
            on = {ln["id"]: (0 if ln["start"] else None) for ln in m["players"]}
            off = {}
            for aid, kind, minute, _ in sorted(res["events"], key=lambda ev: ev[2]):
                if kind == "subbed-in" and on.get(aid) is None:
                    on[aid] = minute
                elif kind in ("subbed-out", "sent-off") and aid not in off:
                    off[aid] = minute
            for aid, start in on.items():
                if start is None:
                    continue
                mins = max(1, round(off.get(aid, end) - start))
                pl = player(aid)
                pl["m"] += mins
                pl["mm"][mid] = mins
            done.add(mid)
    heat["done"] = sorted(done)
    with open(hfile, "w") as f:
        json.dump(heat, f, separators=(",", ":"), ensure_ascii=False)
    # minutes per player for the player table, kept small so the hub doesn't load the whole heat file
    with open(os.path.join(folder, "minutes.json"), "w") as f:
        json.dump({a: {"m": p["m"], "pp": p["pp"], "p": p["p"]} for a, p in heat["players"].items() if p.get("m")}, f, separators=(",", ":"))
    print(f"  {len(heat['players'])} players, {len(done)} matches, {os.path.getsize(hfile) // 1024} KB", flush=True)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for slug in args or LEAGUES:
        build(slug, rebuild="--rebuild" in sys.argv)
