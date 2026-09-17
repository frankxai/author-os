/**
 * AuthorOS Sensory Expansion & Texture Palette Engine
 * Inspired by Sudowrite's Describe and Master Storycraft techniques.
 * Provides deep 5-sense sensory grounding, visceral immersion,
 * atmosphere layering, and genre-specific metaphor generation.
 */

export const GENRE_TEXTURE_PALETTES = {
  'mythic-fantasy': {
    sight: ['luminescent amber veins in dark stone', 'weathered bronze sigils', 'fractured stained glass casting violet pools'],
    sound: ['the deep resonant groan of ancient timber', 'hollow whispering of parchment in drafty vaults', 'distant iron chimes'],
    scent: ['aged cedarwood and ozone', 'crushed bay leaves and tallow smoke', 'damp limestone after midnight rain'],
    touch: ['chilled carved obsidian', 'rough vellum with raised ink grains', 'warm pulsing heartbeat through floorstones'],
    taste: ['bitter alpine tea with clover honey', 'copper and cold well water', 'dust and wild rosemary'],
    atmosphere: 'Ancient, sacred, quietly dangerous, saturated with forgotten memory.',
  },
  'romantasy': {
    sight: ['candlelight reflecting in dark irises', 'the subtle pulse in a hollow throat', 'shadows blending at the balcony rim'],
    sound: ['a breath caught in the dark', 'silk rustling across marble', 'the sharp click of a sheathed blade'],
    scent: ['crushed night-blooming jasmine', 'leather saddlebags and rain-damp wool', 'spiced pomegranate and smoke'],
    touch: ['the shock of skin against cold armor', 'calloused fingers tracing a jawline', 'velvet heavy with winter damp'],
    taste: ['dark spiced wine', 'blood and winter mint', 'crystallized ginger'],
    atmosphere: 'Electric, intimate, fraught with forbidden stakes and sharp longing.',
  },
  'sci-fi-speculative': {
    sight: ['monochromatic HUD reflections on visor glass', 'stuttering neon amber through fog', 'cold starlight through vacuum shields'],
    sound: ['the low 60Hz hum of cryo-coolers', 'the sharp hiss of hydraulic seals', 'synthetic chime of terminal telemetry'],
    scent: ['recirculated cabin air and hot circuits', 'ionized ozone and cooling fluid', 'metallic sharpness of sealed suits'],
    touch: ['matte carbon-fiber composites', 'the vibration of sub-light thrusters', 'thermal gloves against cryogenic frost'],
    taste: ['electrolyte paste with synthetic citrus', 'distilled recycled hydration', 'metallic tang of dry oxygen'],
    atmosphere: 'Vast, clinical, high-stakes isolation against cosmic indifference.',
  },
  'gothic-thriller': {
    sight: ['candle flames guttering in sudden draughts', 'black oil-portraits with cracked varnish', 'fog clinging to iron cemetery gates'],
    sound: ['the slow drip of condensation behind wallpaper', 'muffled footsteps on floorboards overhead', 'a grandfather clock missing its pendulum beat'],
    scent: ['damp plaster and dried lavender', 'stagnant pond water and beeswax candles', 'decaying autumn leaves'],
    touch: ['damp velvet drapes', 'cold brass doorknobs resisting turning', 'cobwebs brushing an unwary cheek'],
    taste: ['black tea steeped too long', 'paraffin wax and cold broth', 'the sour iron of sudden fear'],
    atmosphere: 'Claustrophobic, dread-laden, haunted by the repressed past.',
  },
  'nonfiction-authority': {
    sight: ['crisp typographic charts with clean negative space', 'annotated manuscript margins in sharp graphite', 'calm morning light across a cedar desk'],
    sound: ['the decisive strike of mechanical keys', 'the clean turn of heavy 100gsm paper', 'focused stillness before an insight'],
    scent: ['freshly brewed single-origin espresso', 'linen rag paper and fountain pen ink', 'rain on warm pavement outside the study window'],
    touch: ['smooth leather-bound notebook', 'the solid heft of a fountain pen', 'the satisfying snap of a closed binder'],
    taste: ['bright citrus acidity of morning roast', 'crisp sparkling mineral water', 'dark chocolate with sea salt'],
    atmosphere: 'Clear, authoritative, grounded in empirical evidence and intellectual rigor.',
  },
};

/**
 * Generates structured sensory expansions for a given focus element and genre.
 */
export function generateSensoryExpansion({
  focus = 'room',
  genre = 'mythic-fantasy',
  senses = ['sight', 'sound', 'scent', 'touch', 'taste', 'atmosphere'],
}) {
  const palette = GENRE_TEXTURE_PALETTES[genre] || GENRE_TEXTURE_PALETTES['mythic-fantasy'];
  const results = {};

  for (const sense of senses) {
    if (palette[sense]) {
      results[sense] = Array.isArray(palette[sense])
        ? palette[sense]
        : palette[sense];
    }
  }

  return {
    focus,
    genre,
    expansion: results,
    suggestedProsePrompt: `Describe ${focus} using visceral sensory anchors from the ${genre} palette. Specifically engage ${senses.slice(0, 3).join(', ')} while avoiding AI cliches.`,
  };
}
