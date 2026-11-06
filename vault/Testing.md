---
tags: [testing]
---
# Testing

## Headless Chrome (Playwright)
Installed in the session scratchpad (not in the repository). Scripts screenshot each league at 390, 640, 1024, 1280 and 1440 px in light and dark mode, and report:
- any element spilling outside its card
- sideways page scroll
- clipped text without an ellipsis
- page errors

**ESPN blocks headless browsers** (403 with no CORS headers, even with a normal user agent). The test harness fetches ESPN itself and hands the data to the page. The site code is unchanged.

## Model
`model.js` runs in Node: fair odds → fitted rates → outcome probabilities, in-play and timeline replay.

## Lessons
- [[Log/2026-11-06]]: a fix was reported as live without being seen rendered, and it wasn't working for the user. Now every layout fix is checked in a real browser before it's reported.
- A simulated browser (jsdom) catches script errors, not layout problems.
