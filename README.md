# Treasure Traders: The School Festival Quest

A browser 3D adventure for Japanese grade-4 students. The wind has scattered
the school festival's supplies all over town; ask "Do you have a ___?",
answer "Yes, I do." / "No, I don't.", trade, help and solve puzzles to fill
the Festival Treasure Chest.

Play it at https://nolancasama.github.io/treasure-traders/. See
`CURRENT_STATE.md` for what has and hasn't been tested, and `SPEC.md` for the
frozen design.

## In the classroom

- **Devices:** made for school Chromebooks in Chrome, at 1366×768. Touchscreens
  work. Nothing to install, and no accounts.
- **Saves:** progress stays in that browser on that device, so students should
  keep the same Chromebook and sign-in. Nothing is sent to a server except
  whatever Chrome's own speech recognition uses.
- **Microphones:** allow the microphone when Chrome asks. **Settings** has a mic
  check. If the mic is blocked or unavailable, the game switches to mic-free for
  that session and shows a short notice.
- **Mic-free mode (マイクなしモード):** a teacher setting on the title screen and
  in Settings. Students tap their sentences and answers instead of speaking.
- **Chapters:** there are five, and the chapter menu replays any of them with a
  new puzzle without touching the main save.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | move |
| click or tap the ground | walk there |
| click or tap a person or object | walk there and interact |
| E / Enter | interact |
| Space | microphone |
| 1–9 | item cards (when tappable) |
| 1–2 | answers (when tappable) |
| B | backpack |
| J | journal |
| H | hint |
| Esc | pause / settings |

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build into dist/
npm run e2e        # build + Playwright end-to-end tests (1366x768)
npm run shots      # build + screenshot passes into .tmp/shots/
```

Review galleries: `http://localhost:5173/?gallery=<name>` (development only,
or with `?e2e=1`).

## Deployment

Every push to `main` runs the unit tests and the build, then deploys to GitHub
Pages. Browser tests run locally only, so run `npm run e2e` before pushing.
