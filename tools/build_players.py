#!/usr/bin/env python3
"""Build the player stats database from ESPN's public match data.

For each competition, reads every finished match of the current season, takes each player's
line from the match sheet (goals, assists, shots, saves, cards, fouls...), and writes:

  data/<league>/matches.json   one entry per finished match, with every player's line as a row (columns in ROW);
                               player names and teams are listed once at the top, not in every match
  data/<league>/players.json   season totals per player, plus team info
  data/index/<n>.json          every competition each player appears in, for the links on player pages;
                               a player is in file int(id) % 20, so a page loads one small file

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
           "fifa.wwc", "uefa.weuro", "conmebol.america.femenina", "fifa.w.olympics", "uefa.w.nations",
           # men's national teams, for their team and player pages
           "fifa.friendly", "fifa.world", "uefa.nations", "concacaf.nations.league", "caf.nations_qual", "caf.nations",
           "fifa.worldq.uefa", "fifa.worldq.conmebol", "fifa.worldq.afc", "fifa.worldq.caf", "fifa.worldq.concacaf",
           # men's clubs, for national team players' clubs
           "eng.1", "esp.1", "uefa.champions"]
# World Cup qualifying started in 2023; only its final rounds count, so squads are this cycle's
SINCE = {s: "2025-01-01" for s in LEAGUES if s.startswith("fifa.worldq.")}
UA = "WomensMatchdayHub/1.0 (https://github.com/Redrooster2508/wosomatchday)"
# match-sheet abbreviations kept per player line, in this order
STATS = ["G", "A", "SHOT", "SOG", "SV", "GA", "YC", "RC", "FC", "FA", "OG"]
ROW = ["id", "team", "pos", "no", "start"] + STATS  # one player's line in matches.json


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
    start = max(season.get("startDate") or f"{datetime.now(timezone.utc).year}-01-01T00:00Z", SINCE.get(slug, ""))
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


def pack(m, names, teams):
    """A match from player_lines() in the stored form: rows instead of dicts, names and teams kept once per file."""
    teams.update(m["teams"])
    for ln in m["players"]:
        names[ln["id"]] = ln["name"]
    return {"date": m["date"], "home": m["home"], "away": m["away"], "score": m["score"],
            "players": [[ln["id"], ln["team"], ln["pos"], ln["no"], ln["start"]] + ln["s"] for ln in m["players"]]}


def unpack(m):
    """Player lines of a stored match as dicts, with goals conceded worked out from the score."""
    out = []
    for r in m["players"]:
        ln = dict(zip(ROW[:5], r[:5]), s=r[5:])
        ln["conceded"] = m["score"][1] if ln["team"] == m["home"] else m["score"][0]
        out.append(ln)
    return out


def load(mpath):
    """matches.json, converting files from before the row layout (every line a dict, names in every match)."""
    if not os.path.exists(mpath):
        return {}, {}, {}
    d = json.load(open(mpath))
    if d.get("v") == 2:
        return d["matches"], d["names"], d["teams"]
    names, teams = {}, {}
    return {k: pack(m, names, teams) for k, m in d.get("matches", {}).items()}, names, teams


def totals(matches, names, teams):
    players = {}
    for mid, m in sorted(matches.items(), key=lambda x: x[1]["date"]):
        for ln in unpack(m):
            name = names.get(ln["id"], "")
            p = players.setdefault(ln["id"], {"id": ln["id"], "name": name, "team": ln["team"], "pos": "", "no": ln["no"],
                                              "apps": 0, "starts": 0, "cs": 0, **{k: 0 for k in STATS}})
            # latest match wins for team, position and shirt number (transfers, positional changes)
            p.update(team=ln["team"], no=ln["no"] or p["no"])
            if ln["pos"] and ln["pos"] != "SUB":  # a substitute's line says SUB, not where she played
                p["pos"] = ln["pos"]
            p["apps"] += 1
            p["starts"] += ln["start"]
            for k, v in zip(STATS, ln["s"]):
                p[k] += v
            if ln["pos"] == "G" and ln["start"] and ln["conceded"] == 0:
                p["cs"] += 1
    used = {p["team"] for p in players.values()} | {t for m in matches.values() for t in (m["home"], m["away"])}
    return list(players.values()), {k: dict(v) for k, v in teams.items() if k in used}


def build(slug, rebuild=False):
    folder = os.path.join(DATA, slug)
    os.makedirs(folder, exist_ok=True)
    mpath, ppath = os.path.join(folder, "matches.json"), os.path.join(folder, "players.json")
    matches, names, teams = ({}, {}, {}) if rebuild else load(mpath)
    converted = bool(matches) and json.load(open(mpath)).get("v") != 2
    season, events = season_events(slug)
    if not events and not matches:
        print(f"{slug}: no finished matches this season yet"); return
    todo = [e for e in events if e["id"] not in matches]
    print(f"{slug}: {len(events)} finished matches, {len(todo)} new", flush=True)
    with ThreadPoolExecutor(6) as pool:
        for ev, res in zip(todo, pool.map(lambda e: _safe(slug, e), todo)):
            if res:
                matches[ev["id"]] = pack(res, names, teams)
    keep = {e["id"] for e in events}
    matches = {k: v for k, v in matches.items() if k in keep}  # drop matches from earlier seasons
    if not todo and not converted and len(matches) == len([m for m in matches if m in {e["id"] for e in events}]) and os.path.exists(ppath):
        print("  no new matches; files left as they are"); return
    seen = {r[0] for m in matches.values() for r in m["players"]}
    names = {k: v for k, v in names.items() if k in seen}
    players, teams = totals(matches, names, teams)
    for ev in events:  # club colours, for player badges
        for c in ev["competitions"][0]["competitors"]:
            t = c.get("team") or {}
            if str(t.get("id")) in teams and t.get("color"):
                teams[str(t["id"])]["color"] = t["color"]
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    with open(mpath, "w") as f:
        json.dump({"v": 2, "updated": stamp, "stats": STATS, "row": ROW, "names": names,
                   "teams": {k: {x: v[x] for x in ("name", "abbr", "logo") if x in v} for k, v in teams.items()}, "matches": matches},
                  f, separators=(",", ":"), ensure_ascii=False)
    with open(ppath, "w") as f:
        json.dump({"updated": stamp, "season": season.get("displayName") or season.get("year"), "matches": len(matches),
                   "stats": STATS, "teams": teams, "players": players}, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  {len(players)} players from {len(matches)} matches", flush=True)


SHARDS = 20


def write_index():
    """{athlete id: [[competition, apps], ...]} across every competition, most appearances first."""
    idx = {}
    for slug in LEAGUES:
        p = os.path.join(DATA, slug, "players.json")
        if os.path.exists(p):
            for pl in json.load(open(p))["players"]:
                idx.setdefault(pl["id"], []).append([slug, pl["apps"]])
    shards = [{} for _ in range(SHARDS)]
    for aid, comps in idx.items():
        shards[int(aid) % SHARDS][aid] = sorted(comps, key=lambda c: -c[1])
    os.makedirs(os.path.join(DATA, "index"), exist_ok=True)
    for n, sh in enumerate(shards):
        path, body = os.path.join(DATA, "index", f"{n}.json"), json.dumps(sh, separators=(",", ":"), sort_keys=True)
        if not os.path.exists(path) or open(path).read() != body:   # only real changes reach the repository
            with open(path, "w") as f:
                f.write(body)
    print(f"index: {len(idx)} players in {SHARDS} files", flush=True)


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
    write_index()
