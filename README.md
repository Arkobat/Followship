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
| `src/data/items.ts` | Every item in the game: stats, effects, where it drops (data in `itemsData.ts`, generated) |
| `src/data/loadout.ts` | Neck / relic / weapon tabs: pick limits and tiers (data in `loadoutData.ts`, generated) |
| `src/data/gems.ts` | Socket gems: six colours in four sizes (150 / 250 / 350 / 500) |
| `src/data/gemPower.ts` | Gem power per colour (what you have, what the build reaches) and the gem traits it unlocks (data in `gemTraitsData.ts`, generated) |
| `src/components/tooltip/` | The hover tooltips: `<Tip>` on anything, the card layer, and the cards for items, lines, talents and gems |
| `src/state/buildStore.ts` | Save data: gear lines per slot, tab picks, the build you follow and your saved builds (`localStorage`) |
| `src/state/gearWriter.ts` | Whose gear the paper doll and slot editor change: yours, or the build's (edit mode) |
| `src/utils/progress.ts` | Works out x/3 per slot, checklist counts and reroll suggestions |
| `src/utils/shareCode.ts` | Build share codes and links (see "Share codes") |
| `src/data/shortCodes.ts` | The two-letter code of everything a share code names |
| `src/components/planner/` | Gear planner: paper doll, slot editor, tier lists, checklist, Gems and Dungeons tabs |
| `scripts/` | fellows.gg scrapes + generators for the recommended builds, tiers, items, gem traits and built-in builds |
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

- Each of the 14 pieces is an item with 3 lines. Pick the item you wear (top of the slot editor: every item that
  fits the slot, with its stats, effect and where it drops; weapons, relics and legendaries also by item level; stats default to the highest) and enter what
  rolled; the x/3 badge is calculated from your checklist. The item and its lines are separate: the lines rate it.
  Without a build, lines are just "entered" (–/3): there is nothing to rate them against.
- The line picker lists everything a line can roll (the build's entries first, then by type) and filters as you
  type. The catalog has every line, so there is no "other" entry; old saves keep theirs until replaced.
- In the slot editor, ← → switch slot (after the third line the search closes, so they work straight away);
  Ctrl + ← → switch even while typing in the search.
- A legendary has no lines (any saved on its slot, left from the piece before, are ignored). With a build, a legendary
  anywhere but the build's legendary slot is to be replaced: the build wants a piece with lines there ("✕ Build wants
  a piece with lines"), so a legendary chest doesn't count when the build's legendary is a helm. Without a build it
  just fills the slot. (Older saves may have a piece marked as having no lines; "It has lines after all" undoes it.)
- Changing a piece's item (Change, top of the slot editor) clears its lines and socket gem too, since a new piece comes
  without them. A checkbox in the item list turns that off; the choice is remembered for every slot (in its own
  localStorage key, not the save). Picking the same item again, or picking one for an empty slot, clears nothing.
- Hovering an empty slot or socket says what the build wants there: "Build wants" its item (or a piece with lines) and
  the lines the build's gear has on it (its own plan, or the layout edit mode shows), or the socket's gem. A slot with
  lines entered but no item gets only the item, since its lines are rated on the tile. Edit mode adds nothing: the
  tiles are the build.
- Left side (armour) can roll anything; the right side (neck, wrists, rings, relics, weapon) only enchants and
  gems. A gem line only rerolls into another gem. Reroll suggestions follow those rules and prefer the right
  side for enchants. Tooltips name what kind of line each target is ("↻ Enchant: Kindling").
- In the slot editor, a line's "Reroll to …" is a button: once you've rerolled it in game, click it and confirm, and
  the line switches to it.
- The checklist's legendary takes over its slot (a legendary has no lines); the slot is done once you wear it (pick
  it as the slot's item). Until then the piece you wear there can still have its item and lines entered.
- A piece to replace (the legendary's slot included) still gets reroll tips, since getting the item can take a while.
  They come after the pieces you keep have had their pick, so they get what's left (often "anything").
- The checklist counts every copy: with three of something the build wants two, it reads 3/2 in red (still done,
  faded and struck through), says which piece has the extra, and the extra line gets a reroll tip. Pieces you keep
  claim the copies first, so the extra lands on a piece to replace (or the legendary's slot) when one has it: reroll
  that, not the keeper.
- A build names an item for each slot (legendary, weapon, two relics, armour). An empty slot shows the build's item
  faded; wearing something else there frames the tile red ("✕ Build wants …"), and the checklist lists those slots
  at the top with a button to open each. Rings and relics count in either slot of the pair, and socket gems in any
  socket: wearing them swapped is never wrong. (Charms are only rated against top players, not by slot.)
- The Gear tab under the doll sorts the pieces: Reroll (lines to change), Replace (not the build's item, with the
  build's legendary as its own group: "Get legendary", each with its reroll tips for meanwhile) and Complete (all lines
  right).
- Edit mode (Edit build in the checklist's menu) edits the build the way you enter gear: the paper doll shows the
  build's gear, and clicking a slot picks its item and lines, a socket its gem, a weapon tab its tree. Where a line
  sits doesn't matter, only how many: a build with Griffin's Might on the helm is met by Griffin's Might on the
  chest. The checklist shows the counts as you go. Builds without gear of their own (built in, shared, older) are
  laid out from their counts the first time you edit them; anything that doesn't fit is listed.
- Neck (3 powers), relics (1 charm each, never the same twice) and weapon (its tree, picked from the aspect down:
  aspect, enchant, sigil, enchant, sigil) have tabs with every option tiered S–F by how many top players pick it. Weapon tree picks count
  toward the checklist like a gear line.
- Builds name their talents, but talents aren't on the checklist and don't count toward it. The Talents tab under
  the doll (Gear / Talents) is the in-game grid with the build's talents lit: it shows what to take, not what you
  have. In edit mode a click adds or takes out a talent (one that costs more points than are left can't be added).
  Every talent is tiered by how many top players pick it.
- The Stats panel under the doll is the character sheet: item level (once every slot is filled), health, mana, armor
  and physical damage reduction, stamina and the primary stat, each secondary's rating and percent, parry, dodge,
  block, cooldown reduction and gem power. Edit mode shows the build's. Hover a stat for what makes it up. It adds up
  (`src/utils/stats.ts`, hero bases in `src/data/heroStats.ts`):
  - base 100 stamina and 100 primary stat, plus every item's stats at its item level and temper, enchant lines (gear
    and weapon tree), necklace powers (The Oak's +25% armor, The Shadow's magic damage reduction), gem traits the gem
    power unlocks ("+N Stat", "+N%"; a higher rank replaces the lower), and a legendary's +10% primary stat and health.
    Percent bonuses multiply.
  - health = (hero base + stamina × hero multiplier) × 1.1 with a legendary; armor reduction = armor / (armor + 1024).
  - secondaries: 0.16% per rating, with diminishing returns per bracket of the converted percent (10 / 15 / 20 / 25%
    cost 1 / 0.98 / 0.96 / 0.94, beyond that 0.92, compounding); then flat percents (Critical Strike's 5% base, gem
    traits) are added.
  - a generic legendary's armor is scaled to the hero's armor type (plate, mail, leather, cloth weights from the game).

  Checked against top players' character sheets on fellows.gg (Xavian and Helena match exactly). Talents and buffs
  aren't counted, and there's no power score. Sources: the game's data and combat notes in Seriousnes/FellowshipAnalyzer
  (`CombatMechanics.md`), solxnx.github.io, and fellowbis.com's stats guide (season 2).
- Items at item level 315 are Regal (red) and can be tempered 0–8 times (the Tempered select under the item, 8/8 by
  default). Each step adds 1 to every stat but armor, and 2 Stamina; armor doesn't change.
- Armor has a name, icon and armor value per armor type: Helena and Xavian see plate ("Blackguard Shoulderplates"),
  Rime, Ardeos and Aeona cloth, and so on. Every hero sees their own.
- Socket gems (the socket on the neck, wrists and both rings) are separate from the gem lines rolled on gear. The
  build names the gem for each socket (new builds start from the most used; the rings from the most used pair; edit
  mode picks the colour, always the largest), and the round socket after a piece's lines holds the gem you have, picked from the in-game grid (colour by size,
  150 / 250 / 350 / 500): gold when it matches, amber when it's the right colour but smaller than the build's
  (always the largest), red when it's another colour, and the build's gem shown faded while empty. A socket gem only
  adds gem power, so which socket holds it doesn't matter: the build's gems are matched to yours wherever they sit
  (Emerald in the neck and Diamond on the wrists is right when the build has them the other way round), a gem of the
  right colour takes that colour's gem, and the rest go to empty sockets first (`matchSockets` in `progress.ts`).
- The Gems tab (Gear / Talents / Gems) is the in-game gems window: each colour's ten traits, lit when your gear's gem
  power reaches them, and outlined in gold up to what the build reaches (a trait you haven't unlocked stays as grey as
  the rest; only the outline marks it). A gem line gives 100 of its colour, a socket gem its size. Orb of Hidden
  Riches adds 25% to all of it, but only while worn (not because the build names it). It's read only; the gems come
  from the gear.
- The Dungeons tab ranks the dungeons by how many of the build's items you don't have yet drop there, and lists them.
  Items that drop in every dungeon aren't ranked: they're listed under "From any dungeon". That's any item fellows.gg
  lists for every dungeon (the legendaries), plus weapons and relics, which drop everywhere whatever it lists. Xul, The
  Blood Monolith drops every item, so it isn't ranked either (a note says so). With every item in place it says
  you're good to go.
- Hover (or tab to) anything for a tooltip like the game's: items with their stats, effect and drops; lines, talents,
  tab picks and gem traits with what they do and where they stand in your build. Touch has no hover; the pickers show
  the same text there.
- The build (checklist, talents and socket gems) can be shared as a code or link, with its name; loading one never
  touches the gear. Codes carry the counts, not where each line sits: a loaded build is laid out again when edited.

## Builds

Gear belongs to the hero; the build is what the checklist aims for. A hero opens with no build: you can enter gear
straight away, and the checklist offers Choose a build, Start from scratch or Load a code. Stop using this build (in
the checklist's menu, or on the build's card) goes back to no build at any time; your gear (items and lines) stays,
and the next build that names an item you wear counts it as had.

Looking at a hero saves nothing: a hero counts as started (✓ on the selector, "Continue build") once you enter gear,
pick something on a tab or choose a build, and goes back to not started if all of that is undone.

The Builds page (`#/hero/:heroId/builds`, from the checklist's source link or menu) shows every build for the hero
as a card, with how much of it your gear already has, and search, source and tag filters and sorting:

- **Yours**: builds you made. Editing a built-in build saves a copy as yours ("<name> (edited)") and switches to it;
  your own builds save as you edit.
- **Shared**: builds someone sent you. Opening a share link adds its build here (once) and offers to use it; codes
  pasted on the Builds page or in the checklist's share box land here too.
- **Built in**: fellows.gg's leaderboard builds plus the named builds in `scripts/builds/` (method.gg's). They're
  shared by name, with no code: `#/hero/ardeos?build=fire-frogs` (Copy link on the card, or the share box while
  you use one). The name is the build's name as a slug, with the source in front if two sources use the same
  name; opening the link offers the build.

The leaderboard builds (tagged Leaderboard) are real top Eternal players' gear, piece by piece: every item and its
lines, the weapon tree, talents and socket gems, so they open in edit mode exactly as the player wears them. A
smaller socket gem is listed at its largest size (the one to aim for).

- **#1**: the highest-ranked player with a public profile (named after their rank if #1's profile is private).
- **Top 10** and **Top 25**: the real build closest to what those players run. Among the players with full gear who
  wear the group's most common legendary, it picks the one whose lines (counted wherever they sit, weapon tree
  included), items (how many of the group wear each) and talents are nearest the group's. Top 25 keeps the id the
  old "Top players" build had, so anyone on it moves to it.

Copy any build; rename and delete yours and shared ones from their cards.

### Adding built-in builds

1. Add the build to a file in `scripts/builds/` (any `*.json`; one file per source). The format is documented at
   the top of `scripts/generate-builds.mjs`. Everything is named by its in-game name: legendary, weapon, relics,
   talents, socket gems and lines (`aspect` / `glyph` / `sigil` / `enchant` / `gem`, with how many).
2. Run `node scripts/generate-builds.mjs`. It stops and lists anything it can't match, and checks the talents fit
   the points.

Builds without `sockets` use the gems top players run. Ids are `<source>-<hero>-<name>`: renaming or removing a
build drops it from the library, and players who were on it get its checklist saved as a build of their own.
Renaming also breaks links to it (`?build=<name>`).

## Updating the recommended builds and tiers

New builds start from `src/data/recommendedData.ts`, and the tier lists come from `src/data/loadoutData.ts`.
Both are generated from fellows.gg:

1. Open any fellows.gg page, paste `scripts/scrape-fellows.js` into the browser console, and wait (it pauses
   between requests, ~10 minutes). It reads the top 25 of each hero's leaderboard, every public profile's gear piece
   by piece. Save the JSON it prints (also in `window.fellowsBuilds`) as `scripts/fellows-builds.json`.
2. Run `node scripts/generate-recommended.mjs`, then `node scripts/generate-builds.mjs` (the named builds use the
   same data). It stops and lists any line missing from the catalog, any item missing from `itemsData.ts` (update
   the items first) and any talent it doesn't know.
3. New legendaries, necklace powers, charms, relics, weapons, talents or socket gems need icons in `public/icons/`
   (`legendary-<hero>-<slot>`, `neck-<id>`, `charm-<id>`, `relic-<id>`, `weapon-<id>`, `talent-<id>`, `socket-<id>`; 96px webp). Without one they
   show a lettered tile.

The leaderboard builds (#1, Top 10, Top 25) are picked as described under "Builds". The defaults built-in builds
without socket gems fall back to (and that older saves are upgraded with) come from the Top 25 build, with the
talent set that has the highest total pick rate within the points. Tiers come from the public profiles among the
top 25: S ≥ 60% · A ≥ 35% · B ≥ 20% · C ≥ 10% · D ≥ 3% of them pick it (socket gems count every size of a colour).

## Updating the items

`src/data/itemsData.ts` is every item in fellows.gg's item database: stats (the primary stat is stored as `primary`:
it follows the hero), weapon abilities, legendary powers and the dungeons each drops in. Stats are at the highest item
level an item comes in (315 for this season's items; older ones stop at 240), not fellows.gg's default. Weapons,
relics and legendaries also have them at every level (about 1,100 requests in all, at one per level).

1. Open any fellows.gg page, paste `scripts/scrape-items.js` into the browser console, and wait (~20 minutes). Save
   the JSON it prints as `scripts/fellows-items.json`.
2. New icons go in `public/icons/item-<icon>.webp` (the fellows.gg icon file name, lower case; 96px webp). Without
   one an item shows its slot's icon.
3. Paste `scripts/scrape-worn.js` into the console the same way (~15 minutes). It prints three files: save them as
   `scripts/fellows-worn.json` (what top players wear), `scripts/fellows-gems.json` (gem traits) and
   `scripts/fellows-variants.json` (armor names per armor type). New armor-type icons go in `public/icons/` as in
   step 2.
4. Run `node scripts/generate-items.mjs`. It stops and lists any stat, slot or hero it doesn't know.

fellows.gg's item database mixes tempered and untempered stats, so Regal stats (at 8/8) come from what top players
wear: each worn piece is brought to 8/8 and the most common value kept. Items nobody wears are corrected from the
slot's Stamina at 8/8. Armor per armor type comes from worn pieces too.

Save data stores fellows.gg's item ids, so items keep their ids across updates. fellows.gg names weapons
generically ("Darkfrost Arms"); each hero's weapon ("Darkfrost Talons") is matched to its item by its ability, and
the item takes the hero's name and icon. Relics are matched by fellows.gg's slug, and the heroes' legendaries by id.
The generator also works out each hero's main stat (Strength, Agility, Intellect) from items made for some heroes
only; that names their stats and enchants.

## Updating the gem traits

`src/data/gemTraitsData.ts` is each gem colour's ten traits and the power they unlock at (80, 150, 220, 300, 450,
600, 800, 1000, 1250, 1500), from `scripts/fellows-gems.json` (step 3 above). Run `node scripts/generate-gems.mjs`.
A trait no top player has unlocked isn't on fellows.gg: add it to `MANUAL` in the script, copied from the in-game
tooltip (Blessing of the Artisan II, Diamond 1500, is there; it's dropped once fellows.gg lists the trait).
Icons are `public/icons/gem-trait-<id>.webp` (fellows.gg's trait id, 96px webp); without one a trait shows a lettered
tile. Socket gem icons are `public/icons/socket-<size>-<colour>.webp`.

## Updating the catalog

`src/data/catalog.ts` lists every aspect, glyph, sigil, enchant, gem and defensive trait.
It mirrors fellows.gg's database (weapon traits → aspects/sigils/enchants/defensive by
category, blessings → glyphs, gems), with icons in `public/icons/<id>.webp` (96px).

To add an entry, append a row to the right group, and drop its icon in `public/icons/` (optional:
entries without an icon show a lettered tile). Never change an existing `id`; saved builds reference it.
There is no free-text "other" entry: the catalog is the full list (checked against method.gg), so a missing line
is a catalog row to add. Custom entries in older saves (`custom-…`, `other`) still show, with a lettered tile.

Enchants use their in-game names, which depend on the hero's main stat: Griffin's Might (Strength) is Strix's Guile
(Agility) and Salamander's Cunning (Intellect). Every hero sees their own names, everywhere (`nameFor`); the first
two aliases of an enchant are its Guile and Cunning names, and fellows.gg's older names follow. Their ids changed once, from fellows.gg's names; `OLD_ENCHANT_IDS` maps the old ids, for save
data.

Every new entry also needs a share code (see below).

## Share codes

A shared build is one short code (about 60–100 characters with its name), and a link is that code after
`#/hero/<id>?checklist=`. Inside, the build is written as text with every item as a two-letter code from
`src/data/shortCodes.ts` (`gm7` is Griffin's Might ×7), then packed into base64url; the name follows after a
dot. The format is documented at the top of `src/utils/shareCode.ts`.

Codes in people's links depend on those two letters, so never change or reuse one. Anything new (a hero, weapon,
relic, talent, legendary or catalog entry) needs a code that isn't taken: two letters a–z, unique across the whole
file (socket gems reuse their colour's gem code). Without one it's left out of share codes; the dev server logs
a console error for anything missing a code and for any code used twice.

## Changing the save format

Bump `SCHEMA_VERSION` in `src/state/buildStore.ts` and handle the old shape in `migrate()`, so
existing users keep their builds.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `master`.
One-time setup in the GitHub repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The build uses a relative base path and hash routing, so it works at `https://<user>.github.io/<repo>/`
without configuration.

Hero art and names © Chief Rebel / Fellowship; hero data referenced from [fellows.gg](https://fellows.gg).
