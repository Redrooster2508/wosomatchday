#!/usr/bin/env python3
"""Build the player stats database from ESPN's public match data.

For each competition, reads every finished match of the current season, takes each player's
line from the match sheet (goals, assists, shots, saves, cards, fouls...), and writes:

  data/<league>/matches.json   one entry per finished match, with every player's line
  data/<league>/players.json   season totals per player, plus team info

Matches already in matches.json are not fetched again, so later runs only read new results.
A GitHub Actions workflow (.github/workflows/players.yml) runs this on a schedule.

Usage:
  python3 tools/build_players.py                 # all competitions
  python3 tools/build_players.py eng.w.1         # one competition
  python3 tools/build_players.py --rebuild       # ignore the cache and read every match again
"""
import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/"
LEAGUES = ["eng.w.1", "esp.w.1", "usa.nwsl", "uefa.wchampions",
           # national teams
           "fifa.friendly.w", "fifa.wwcq.ply", "concacaf.womens.championship", "caf.w.nations", "afc.w.asian.cup",
           "fifa.wwc", "uefa.weuro", "conmebol.america.femenina", "fifa.w.olympics", "uefa.w.nations"]
UA = "WomensMatchdayHub/1.0 (https://github.com/Redrooster2508/wosomatchday)"
# match-sheet abbreviations kept per player line, in this order
STATS = ["G", "A", "SHOT", "SOG", "SV", "GA", "YC", "RC", "FC", "FA", "OG"]


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def season_events(slug):
    """Finished matches of the current season."""
    board = get(SITE + slug + "/scoreboard")
    season = board["leagues"][0].get("season") or {}
    start = season.get("startDate") or f"{datetime.now(timezone.utc).year}-01-01T00:00Z"
    end = season.get("endDate") or f"{datetime.now(timezone.utc).year + 1}-01-01T00:00Z"
    now = datetime.now(timezone.utc)
    events = {}
    for year in range(int(start[:4]), min(int(end[:4]), now.year) + 1):
        for ev in get(f"{SITE}{slug}/scoreboard?dates={year}&limit=1000").get("events", []):
            if start <= ev["date"] < end and ev["status"]["type"].get("completed"):
                events[ev["id"]] = ev
    return season, sorted(events.values(), key=lambda e: e["date"])


def player_lines(slug, ev):
    """Every player who appeared in one match, with their line from the match sheet."""
    s = get(f"{SITE}{slug}/summary?event={ev['id']}")
    comp = ev["competitions"][0]
    score = {str(c["team"]["id"]): int(c.get("score") or 0) for c in comp["competitors"]}
    home = next(c for c in comp["competitors"] if c["homeAway"] == "home")
    away = next(c for c in comp["competitors"] if c["homeAway"] == "away")
    teams, lines = {}, []
    for r in s.get("rosters", []):
        t = r.get("team") or {}
        tid = str(t.get("id"))
        teams[tid] = {"name": (t.get("shortDisplayName") or t.get("displayName") or "").strip(), "abbr": t.get("abbreviation", ""),
                      "logo": (t.get("logos") or [{}])[0].get("href", "") or t.get("logo", "")}
        opp = next((k for k in score if k != tid), None)
        for p in r.get("roster", []):
            if not (p.get("starter") or p.get("subbedIn")):
                continue
            st = {x.get("abbreviation"): x.get("value", 0) for x in p.get("stats", [])}
            a = p.get("athlete") or {}
            lines.append({"id": str(a.get("id")), "name": a.get("displayName", ""), "team": tid, "pos": (p.get("position") or {}).get("abbreviation", ""),
                          "no": p.get("jersey", ""), "start": 1 if p.get("starter") else 0,
                          "s": [int(st.get(k) or 0) for k in STATS], "conceded": score.get(opp, 0) if opp else 0})
    return {"date": ev["date"], "home": str(home["team"]["id"]), "away": str(away["team"]["id"]),
            "score": [int(home.get("score") or 0), int(away.get("score") or 0)], "teams": teams, "players": lines}


def totals(matches):
    players, teams = {}, {}
    for mid, m in sorted(matches.items(), key=lambda x: x[1]["date"]):
        teams.update(m["teams"])
        for ln in m["players"]:
            p = players.setdefault(ln["id"], {"id": ln["id"], "name": ln["name"], "team": ln["team"], "pos": "", "no": ln["no"],
                                              "apps": 0, "starts": 0, "cs": 0, **{k: 0 for k in STATS}})
            # latest match wins for team, position and shirt number (transfers, positional changes)
            p.update(name=ln["name"], team=ln["team"], no=ln["no"] or p["no"])
            if ln["pos"] and ln["pos"] != "SUB":  # a substitute's line says SUB, not where she played
                p["pos"] = ln["pos"]
            p["apps"] += 1
            p["starts"] += ln["start"]
            for k, v in zip(STATS, ln["s"]):
                p[k] += v
            if ln["pos"] == "G" and ln["start"] and ln["conceded"] == 0:
                p["cs"] += 1
    return list(players.values()), teams


def build(slug, rebuild=False):
    folder = os.path.join(DATA, slug)
    os.makedirs(folder, exist_ok=True)
    mpath, ppath = os.path.join(folder, "matches.json"), os.path.join(folder, "players.json")
    matches = {} if rebuild or not os.path.exists(mpath) else json.load(open(mpath)).get("matches", {})
    season, events = season_events(slug)
    if not events and not matches:
        print(f"{slug}: no finished matches this season yet"); return
    todo = [e for e in events if e["id"] not in matches]
    print(f"{slug}: {len(events)} finished matches, {len(todo)} new", flush=True)
    with ThreadPoolExecutor(6) as pool:
        for ev, res in zip(todo, pool.map(lambda e: _safe(slug, e), todo)):
            if res:
                matches[ev["id"]] = res
    keep = {e["id"] for e in events}
    matches = {k: v for k, v in matches.items() if k in keep}  # drop matches from earlier seasons
    players, teams = totals(matches)
    for ev in events:  # club colours, for player badges
        for c in ev["competitions"][0]["competitors"]:
            t = c.get("team") or {}
            if str(t.get("id")) in teams and t.get("color"):
                teams[str(t["id"])]["color"] = t["color"]
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    with open(mpath, "w") as f:
        json.dump({"updated": stamp, "stats": STATS, "matches": matches}, f, separators=(",", ":"), ensure_ascii=False)
    with open(ppath, "w") as f:
        json.dump({"updated": stamp, "season": season.get("displayName") or season.get("year"), "matches": len(matches),
                   "stats": STATS, "teams": teams, "players": players}, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  {len(players)} players from {len(matches)} matches", flush=True)


def _safe(slug, ev):
    try:
        return player_lines(slug, ev)
    except Exception as e:
        print(f"  skipped {ev['id']} ({ev.get('shortName')}): {e}", flush=True)
        return None


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for slug in args or LEAGUES:
        build(slug, rebuild="--rebuild" in sys.argv)
