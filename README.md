# Fellowship Build Guide

A frontend-only build planner for the heroes of *Fellowship*. React + TypeScript + Vite,
deployed to GitHub Pages. Progress is saved in the browser's `localStorage`: your gear per hero, and as many
builds per hero as you like.

## Develop

```bash
npm install
npm run dev
```

`npm run build` type-checks and builds to `dist/`. `npm run lint` runs oxlint.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/data/heroes.ts` | Hero roster: name, role, epithet, portrait, tile crop |
| `src/data/roles.ts` | Roles (Tank / Damage Dealer / Healer), order and accent colours |
| `src/data/catalog.ts` | Aspects, glyphs, sigils, enchants, gems and defensive traits |
| `src/data/gearSlots.ts` | The 14 gear slots, paper-doll layout, and what can roll on each side |
| `src/data/recommended.ts` | Legendaries and starting checklists per hero (data in `recommendedData.ts`, generated) |
| `src/data/presetBuilds.ts` | Built-in builds: fellows.gg's per hero plus the named ones (data in `presetBuildsData.ts`, generated) |
| `src/data/loadout.ts` | Neck / relic / weapon tabs: pick limits and tiers (data in `loadoutData.ts`, generated) |
| `src/state/buildStore.ts` | Save data: gear lines per slot, tab picks, the build you follow and your saved builds (`localStorage`) |
| `src/utils/progress.ts` | Works out x/3 per slot, checklist counts and reroll suggestions |
| `src/utils/shareCode.ts` | Checklist share codes (`FB2.` + base64url JSON; `FB1.` still loads) and links |
| `src/components/planner/` | Gear planner: paper doll, slot editor, tier lists, checklist |
| `scripts/` | fellows.gg scrape + generators for the recommended builds, tiers and built-in builds |
| `scripts/builds/*.json` | Named built-in builds by in-game names (e.g. `method.json`, from method.gg) |
| `src/pages/HeroSelectPage.tsx` | Hero selector (`#/heroes`) |
| `src/pages/HeroBuildPage.tsx` | A hero's gear and checklist (`#/hero/:heroId`) |
| `src/pages/BuildsPage.tsx` | A hero's builds to pick from (`#/hero/:heroId/builds`) |
| `src/assets/heroes/` | Full-body hero portraits |

Opening the site at `/` resumes the last hero you opened, or shows the selector if there is none.

## Adding a hero

1. Save the portrait as `src/assets/heroes/<id>.webp` (full-body art works; the tile crops to the face).
2. Import it at the top of `src/data/heroes.ts` and add an entry to `HEROES`, in the position it
   should appear within its role.
3. Tune `portraitFocus` (`x`/`y` are percentages of the image where the face is, `zoom` is how far
   to scale in) until the face fills the tile.

The `id` is used in URLs and as the save-data key, so don't rename it once released.

## How the planner works

- Each of the 14 pieces has 3 lines. You enter what rolled; the x/3 badge is calculated from your checklist.
  Without a build, lines are just "entered" (–/3): there is nothing to rate them against.
- The line picker lists everything a line can roll (the build's entries first, then by type) and filters as you
  type. The catalog has every line, so there is no "other" entry; old saves keep theirs until replaced.
- In the slot editor, ← → switch slot (after the third line the search closes, so they work straight away);
  Ctrl + ← → switch even while typing in the search.
- "No lines? Mark as legendary" (small, under a piece's lines) marks a slot as filled with nothing to roll, e.g. a
  legendary that isn't the build's. It counts as complete; "It has lines after all" undoes it.
- Left side (armour) can roll anything; the right side (neck, wrists, rings, relics, weapon) only enchants and
  gems. A gem line only rerolls into another gem. Reroll suggestions follow those rules and prefer the right
  side for enchants.
- The checklist's legendary takes over its slot (a legendary has no lines); the slot is done once you have it.
  Until then, "I have it" is the slot editor's main (focused) action, and the piece you wear there can still have
  its lines entered; they count, but get no reroll tips.
- The checklist also names the gear to get: legendary, weapon and two relics (with how many top players run each),
  ticked off with "I have it".
- Neck (3 powers), relics (1 charm each, never the same twice) and weapon (its tree, picked from the aspect down:
  aspect, enchant, sigil, enchant, sigil) have tabs with every option tiered S–F by how many top players pick it. Weapon tree picks count
  toward the checklist like a gear line.
- Builds name their talents, but talents aren't on the checklist and don't count toward it. The Talents tab under
  the doll (Gear / Talents) is the in-game grid, where you click what you have: the build's talents are marked, and
  ones it doesn't run are flagged to swap out. Match build copies the build's talents; Save to build makes your
  picks the build's. Every talent is tiered by how many top players pick it.
- Socket gems (the socket on the neck, wrists and both rings) are separate from the gem lines rolled on gear. The
  checklist names the gem for each socket (new builds start from the most used; the rings from the most used pair),
  and the round socket after a piece's lines holds the gem you have: gold when it matches, red when it doesn't, and
  the build's gem shown faded while empty.
- The build (checklist, talents and socket gems) can be shared as a code or link, with its name; loading one never
  touches the gear.

## Builds

Gear belongs to the hero; the build is what the checklist aims for. A hero opens with no build: you can enter gear
straight away, and the checklist offers Choose a build, Start from scratch or Load a code. Stop using this build (in
the checklist's menu, or on the build's card) goes back to no build at any time; your gear stays, and so do the
legendary, weapon and relics you marked "I have it" (they carry over to the next build that names them).

Looking at a hero saves nothing: a hero counts as started (✓ on the selector, "Continue build") once you enter gear,
pick something on a tab or choose a build, and goes back to not started if all of that is undone.

The Builds page (`#/hero/:heroId/builds`, from the checklist's source link or menu) shows every build for the hero
as a card, with how much of it your gear already has, and search, source and tag filters and sorting:

- **Yours**: builds you made. Editing a built-in build saves a copy as yours ("<name> (edited)") and switches to it;
  your own builds save as you edit.
- **Shared**: builds someone sent you. Opening a share link adds its build here (once) and offers to use it; codes
  pasted on the Builds page or in the checklist's share box land here too.
- **Built in**: fellows.gg's top-player build ("Top players") plus the named builds in `scripts/builds/`.

Copy any build; rename and delete yours and shared ones from their cards.

### Adding built-in builds

1. Add the build to a file in `scripts/builds/` (any `*.json`; one file per source). The format is documented at
   the top of `scripts/generate-builds.mjs`. Everything is named by its in-game name: legendary, weapon, relics,
   talents, socket gems and lines (`aspect` / `glyph` / `sigil` / `enchant` / `gem`, with how many).
2. Run `node scripts/generate-builds.mjs`. It stops and lists anything it can't match, and checks the talents fit
   the points.

Builds without `sockets` use the gems top players run. Ids are `<source>-<hero>-<name>`: renaming or removing a
build drops it from the library, and players who were on it get its checklist saved as a build of their own.

## Updating the recommended builds and tiers

New builds start from `src/data/recommendedData.ts`, and the tier lists come from `src/data/loadoutData.ts`.
Both are generated from fellows.gg:

1. Open any fellows.gg page, paste `scripts/scrape-fellows.js` into the browser console, and wait (it pauses
   between requests, ~15 minutes). Save the JSON it prints as `scripts/fellows-builds.json`.
2. Run `node scripts/generate-recommended.mjs`. It stops and lists any entry missing from the catalog.
3. New legendaries, necklace powers, charms, relics, weapons, talents or socket gems need icons in `public/icons/`
   (`legendary-<hero>-<slot>`, `neck-<id>`, `charm-<id>`, `relic-<id>`, `weapon-<id>`, `talent-<id>`, `socket-<id>`; 96px webp). Without one they
   show a lettered tile.

The recommendation per hero is the real top-20 build (gear lines plus weapon tree picks) closest to what all of
them run, among players wearing the most common legendary. Its talents are the set with the highest total
pick rate that fits the points. Tiers: S ≥ 60% · A ≥ 35% · B ≥ 20% · C ≥ 10% · D ≥ 3%
of top players pick it.

## Updating the catalog

`src/data/catalog.ts` lists every aspect, glyph, sigil, enchant, gem and defensive trait.
It mirrors fellows.gg's database (weapon traits → aspects/sigils/enchants/defensive by
category, blessings → glyphs, gems), with icons in `public/icons/<id>.webp` (96px).

To add an entry, append a row to the right group, and drop its icon in `public/icons/` (optional:
entries without an icon show a lettered tile). Never change an existing `id`; saved builds reference it.
There is no free-text "other" entry: the catalog is the full list (checked against method.gg), so a missing line
is a catalog row to add. Custom entries in older saves (`custom-…`, `other`) still show, with a lettered tile.

Enchants use their in-game names (e.g. Griffin's Might; the Guile and Cunning versions and fellows.gg's older
names are aliases). Their ids changed once, from fellows.gg's names; `OLD_ENCHANT_IDS` maps the old ids, for save
data and `FB1.` codes.

## Changing the save format

Bump `SCHEMA_VERSION` in `src/state/buildStore.ts` and handle the old shape in `migrate()`, so
existing users keep their builds.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `master`.
One-time setup in the GitHub repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build uses a relative base path and hash routing, so it works at `https://<user>.github.io/<repo>/`
without configuration.

Hero art and names © Chief Rebel / Fellowship; hero data referenced from [fellows.gg](https://fellows.gg).
