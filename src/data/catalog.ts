/**
 * Everything you can socket, enchant or roll onto gear, grouped the way the
 * checklist shows it. Sourced from fellows.gg (Early Access S3) — run through
 * the "Updating the catalog" steps in the README when a patch adds more.
 *
 * Entries are shared by all heroes: the game doesn't restrict them per hero.
 */

export type CategoryId = 'aspect' | 'glyph' | 'sigil' | 'enchant' | 'gem' | 'defensive'

export interface CategoryDefinition {
  id: CategoryId
  label: string
  /** Singular, for "Add aspect" style buttons. */
  singular: string
  color: string
}

/** Display order of the checklist. */
export const CATEGORIES: CategoryDefinition[] = [
  { id: 'aspect', label: 'Aspects', singular: 'aspect', color: '#b58cff' },
  { id: 'glyph', label: 'Glyphs', singular: 'glyph', color: '#e9c178' },
  { id: 'sigil', label: 'Sigils', singular: 'sigil', color: '#4fd1c5' },
  { id: 'enchant', label: 'Enchants', singular: 'enchant', color: '#f0924a' },
  { id: 'gem', label: 'Gems', singular: 'gem', color: '#ff6f9c' },
  { id: 'defensive', label: 'Defensive', singular: 'defensive trait', color: '#7fa8e0' },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  CategoryDefinition
>

export interface CatalogEntry {
  /** Stable slug, stored in save data. */
  id: string
  category: CategoryId
  name: string
  /** Other names for the same thing (enchant variants for other main stats). */
  aliases?: string[]
  /** Path under /public. */
  icon?: string
  description?: string
}

type Raw = [id: string, name: string, description?: string, aliases?: string[]]

const icon = (id: string) => `icons/${id}.webp`

function group(category: CategoryId, rows: Raw[], withIcons = true): CatalogEntry[] {
  return rows.map(([id, name, description, aliases]) => ({
    id,
    category,
    name,
    description,
    aliases,
    icon: withIcons ? icon(id) : undefined,
  }))
}

const ASPECTS = group('aspect', [
  ['amethyst-splinters', 'Amethyst Splinters', 'Critical damage and heals apply an extra 4–11% over 8 seconds.'],
  [
    'brave-machinations',
    'Brave Machinations',
    'Weapon Ability gains 9.5–32% crit chance; crits reduce its cooldown by 15–30%.',
  ],
  ['diamond-strike', 'Diamond Strike', 'Damage and heals can conjure a Spectral Beam for 72–237% Main Stat.'],
  ['emerald-judgement', 'Emerald Judgement', 'Damage can conjure an Emerald Spike for 800% Main Stat.'],
  ['heroic-brand', 'Heroic Brand', 'Weapon Ability damage and healing increased by 24–80%.'],
  ['martial-initiative', 'Martial Initiative', 'Weapon Ability grants 10% Main Stat and 15% damage reduction.'],
  ['ruby-storm', 'Ruby Storm', 'Targeted abilities can spawn a Ruby Storm scaling with current health.'],
  [
    'sapphire-aurastone',
    'Sapphire Aurastone',
    'Spirit Ability conjures an Aurastone that pulses stored damage and healing.',
  ],
  [
    'visions-of-grandeur',
    'Visions of Grandeur',
    'Weapon Ability generates Spirit; Spirit Ability cuts its cooldown 25–100%.',
  ],
])

const GLYPHS = group('glyph', [
  ['the-monarch', 'The Monarch', 'MAJOR abilities gain 3–12% Cooldown Acceleration, more with Haste.'],
  ['the-mystic', 'The Mystic', 'POWER abilities gain increased power for every 3% Spirit.'],
  ['the-philosopher', 'The Philosopher', 'MAJOR ability grants Haste, Expertise and Crit based on Spirit.'],
  ['the-sinister', 'The Sinister', 'CORE abilities gain crit chance and crit power.'],
  ['the-subduer', 'The Subduer', 'More damage to low-health enemies; MAJOR abilities shorten CONTROL cooldowns.'],
  ['the-trickster', 'The Trickster', 'POWER abilities grant 2.5–10% crit chance for 4 seconds.'],
  ['the-vehement', 'The Vehement', 'Every few BASIC abilities erupt for poison damage around the target.'],
  ['the-wayfarer', 'The Wayfarer', 'Periodic 6–25% Haste, sooner the more you use CORE abilities.'],
])

const SIGILS = group('sigil', [
  ['hidden-power', 'Hidden Power', 'Abilities build stacks that grant 7.2–24% Main Stat at 5 stacks.'],
  ['hunters-focus', "Hunter's Focus", 'Targeted offensive abilities stack Haste rating on one target.'],
  ['inspired-allegiance', 'Inspired Allegiance', 'Abilities can reduce Weapon Ability cooldown and grant group Haste.'],
  ['kindling', 'Kindling', 'Damage burns and heals cauterize for 483–1680% Main Stat over 9s.'],
  ['navigators-intuition', "Navigator's Intuition", 'Offensive abilities can boost your highest secondary stat.'],
  ['patient-soul', 'Patient Soul', 'Standing still grants 5% Max Health and Expertise rating.'],
  ['seized-opportunity', 'Seized Opportunity', 'Every 20 crits grants Critical Strike rating for 12 seconds.'],
  ['vengeful-soul', 'Vengeful Soul', 'Crits can grant Main Stat, plus a heal when below 50% health.'],
  ['willful-momentum', 'Willful Momentum', 'Spirit rating, and Main Stat when you trigger a Spirit Refund.'],
])

const ENCHANTS: CatalogEntry[] = [
  // One enchant per pair of secondary stats, named per main stat (Might, Guile, Cunning) as in game.
  // fellows.gg still uses older names (the last alias of each); its data is mapped to these in the generator.
  ...group('enchant', [
    ['jotunns-might', "Jotunn's Might", '+6 Critical Strike, +6 Expertise', ["Wyvern's Guile", "Chimera's Cunning"]],
    [
      'griffins-might',
      "Griffin's Might",
      '+6 Critical Strike, +6 Haste',
      ["Strix's Guile", "Salamander's Cunning", "Sun's Might"],
    ],
    ['revenants-might', "Revenant's Might", '+6 Critical Strike, +6 Spirit', ["Wraith's Guile", "Banshee's Cunning"]],
    [
      'behemoths-might',
      "Behemoth's Might",
      '+6 Expertise, +6 Haste',
      ["Huldra's Guile", "Undine's Cunning", "Gryphon's Might"],
    ],
    ['ogres-might', "Ogre's Might", '+6 Expertise, +6 Spirit', ["Vampire's Guile", "Sphinx's Cunning", "Ursa's Might"]],
    [
      'valkyries-might',
      "Valkyrie's Might",
      '+6 Haste, +6 Spirit',
      ["Centaur's Guile", "Unicorn's Cunning", "Manticore's Might"],
    ],
  ]),
]

/**
 * Enchant ids before they took their in-game names (save data before v8, FB1 share codes), by stat pair.
 * `behemoths-might` moved: it was Critical Strike + Expertise, it's now Expertise + Haste.
 */
export const OLD_ENCHANT_IDS: Record<string, string> = {
  'behemoths-might': 'jotunns-might',
  'gryphons-might': 'behemoths-might',
  'manticores-might': 'valkyries-might',
  'suns-might': 'griffins-might',
  'ursas-might': 'ogres-might',
}

const GEMS = group(
  'gem',
  ['Amethyst', 'Diamond', 'Emerald', 'Ruby', 'Sapphire', 'Topaz'].map((name): Raw => [
    `gem-${name.toLowerCase()}`,
    name,
  ]),
)

const DEFENSIVE = group('defensive', [
  ['divine-mediation', 'Divine Mediation', 'Taking damage can heal you, then shield you and your allies.'],
  ['first-man-standing', 'First Man Standing', 'Each new enemy that hits you grants damage reduction.'],
  ['grounded-spirit', 'Grounded Spirit', 'Standing still builds stacks that heal you on moving.'],
  ['heart-of-stone', 'Heart of Stone', 'Gain 2.5–9.3% more Health from Stamina.'],
  ['iron-spikes', 'Iron Spikes', 'Taking damage can raise Armor and reflect physical damage.'],
  ['king-of-the-hill', 'King of the Hill', 'Take 3–12% less damage above 80% health.'],
  ['latent-resurgence', 'Latent Resurgence', 'Heals build stacks that burst-heal you below 50% health.'],
  ['stalwart-readiness', 'Stalwart Readiness', 'Time without taking damage builds damage-reduction stacks.'],
  ['treasure-hunters-delight', "Treasure Hunter's Delight", 'Relic Abilities grant damage reduction for 12 seconds.'],
])

export const CATALOG: CatalogEntry[] = [...ASPECTS, ...GLYPHS, ...SIGILS, ...ENCHANTS, ...GEMS, ...DEFENSIVE]

const ENTRY_BY_KEY = new Map(CATALOG.map((e) => [`${e.category}:${e.id}`, e]))

export function getEntry(category: CategoryId, id: string): CatalogEntry | undefined {
  return ENTRY_BY_KEY.get(`${category}:${id}`)
}

export function entriesFor(category: CategoryId): CatalogEntry[] {
  return CATALOG.filter((e) => e.category === category)
}
