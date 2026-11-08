# Creatures — v0.3

Three.js + Vite build of the Creatures spec, through v0.3 (Day/night and rain). One garden, three tools, four plants and five species that move through Appear → Visit → Resident. Residents earn coins, coins buy seeds in the shop, a journal turns hidden requirements into hints, and a 20-minute day cycle with rain drives growth, hunger and when some species show up.

```bash
npm install
npm run dev
```

All tuning values live in `src/tuning.json`. Add `?speed=10` to the URL to fast-forward game time while playtesting. A red badge shows when it's on.

## Controls (input actions)

| Action | Mouse + keyboard | Touch |
|---|---|---|
| Move cursor | Mouse | Tap |
| Use tool | Left click; hold and drag to repeat across tiles | Tap |
| Focus a creature | Left click it (camera follows) | Tap it |
| Context menu | Right click | Hold |
| Orbit camera | Middle-drag, Q / E | Two-finger twist |
| Zoom camera | Wheel (unless the seed bag is held), R / F | Pinch |
| Pan | WASD, arrow keys, cursor at screen edge | One-finger drag |
| Back | Esc | ✕ button |
| Open shop | B | Shop button |
| Open journal | J | Journal button |
| Select tool | 1 shovel, 2 watering can, 3 seed bag (X / Z cycle) | Tap a tool |
| Next / previous seed | Wheel while the seed bag is held | ◀ ▶ |
| Turn journal page | X / Z (next / previous tool) | ◀ ▶ |
| Mute | M | Speaker button |

Dragging with the seed bag plants on every empty soil tile you cross, and dragging the can waters every dry plant. The shovel only digs tiles of the same kind as the first one you clicked, so a sweep across junk leaves grass alone. Panning stops following a creature.

## Species

| | Name | Eats | Appear | Visit | Resident |
|---|---|---|---|---|---|
| A | Puffkin | Red flower | 16 grass tiles | Adult red flower | 20 grass, 3 adult red |
| B | Glimmer | Blue flower | Adult blue flower | Adult blue flower | 2 adult blue, 4 adult red |
| C | Bumblet | Yellow flower | A red and a blue flower on neighbouring tiles | Adult yellow flower | 6 adult flowers, 3 colors, 10 grass |
| D | Moonmoth | Red flower | 3 adult yellow, at night | Adult red, at night | 4 adult yellow, 4 adult red, one full night here |
| E | Puddlehop | Blue flower | 8 soil tiles, during rain | Adult blue, during rain | 12 soil tiles, 3 adult blue, 2 showers here |

## Journal (v0.2)

- A species gets a page the first time it appears. Unseen species show as a silhouette with one clue line.
- Each page lists Appear, Visit and Resident. Stages tick when met and stay ticked.
- Requirements show as "???" until progress reaches 50% (`journal.hintThreshold`) or the requirement is met. A revealed hint stays revealed.
- The creature info panel only lists revealed requirements, plus a count of unknown ones.
- A red marker on the Journal button, and on the species' list entry, shows new pages and hints until that page is opened.

## Day, night and rain (v0.3)

- One in-game day is 20 minutes of play: 12 day, 2 dusk, 4 night, 2 dawn. The HUD clock shows the time, day number and weather.
- Time only runs while playing. The seed shop and journal pause it, along with growth, creatures and income.
- Rain: a 30% chance each day of one 2–4 minute shower. During rain every growing plant counts as watered.
- Hunger: a resident that goes a full in-game day without eating is Hungry and earns nothing until it eats.
- Moonmoth sleeps through the day. Music crossfades between a day loop and a night lullaby; rain and crickets add ambience.
- All times are in `time` in `tuning.json`. In the console, `game.dayCycle.setTime(900)` jumps to night and `game.dayCycle.forceRain()` starts a shower.

## v0.2.1

- A flower requirement that needs only 1 adult reveals as soon as one flower of that type is planted. Every other requirement still reveals at 50%.
- Desktop browser with mouse and keyboard is the only platform built for now.
- Models and audio are placeholders until a later art and audio pass.

### Stability run

`?autoplay` loads a dev-only bot (`src/dev/autoplay.js`) that plays the full loop through the real game API. Open `http://localhost:5173/?speed=20&autoplay`, then in the browser console:

```js
await autoplay.run(60) // minutes of game time; returns a report with a stage timeline and any errors
```

## Choices the spec left open

- **Species names**: placeholders, set in `tuning.json`.
- **Map**: 16 × 16 instead of the v0.1 spec's 24 × 24. Most tiles start as bare soil, about 16% are junk patches and 4% are rocks. Tune it with the `map` block in `tuning.json`.
- **Grass seed supply**: the start kit includes 10 free grass seeds so tutorial step 2 works before the shop. More are free in the shop.
- **Visitor access**: a trodden soil path runs from the gate to the starting lawn. If junk walls off a flower, creatures still path over junk at a high cost, so they never soft-lock.
- **Appear dwell**: a creature waits at least 4 s in Appear before it can visit, so each banner gets its full 3 s. This stays inside the 10 s trigger window.
- **Resident check**: a visitor settles once it is inside the fence and the resident conditions hold. It doesn't need to have eaten first.
- **Bumblet's Appear**: the red and blue flowers can be at any growth stage, and "adjacent" includes diagonal neighbours.
- **Bumblet's Resident**: "6 adult flowers of 3 colors" counts as two requirements: 6 adult flowers in total, and at least one adult of each of the 3 colors.
- **All species hide their requirements**, A and B included. The v0.1 tutorial prompts still guide the first loop.
- **Audio**: everything is synthesized with WebAudio, including calls, stings, tool and UI sounds, and the music loop.
