'use client';

import { useState } from 'react';

export function SensoryExpansionPalette() {
  const [selectedGenre, setSelectedGenre] = useState('mythic-fantasy');

  const palettes = {
    'mythic-fantasy': {
      title: 'Mythic Fantasy & Living Archives',
      sight: ['Luminescent amber veins in dark stone', 'Weathered bronze sigils', 'Fractured stained glass casting violet pools'],
      sound: ['The deep resonant groan of ancient timber', 'Hollow whispering of parchment in drafty vaults', 'Distant iron chimes'],
      scent: ['Aged cedarwood and ozone', 'Crushed bay leaves and tallow smoke', 'Damp limestone after midnight rain'],
      touch: ['Chilled carved obsidian', 'Rough vellum with raised ink grains', 'Warm pulsing heartbeat through floorstones'],
      taste: ['Bitter alpine tea with clover honey', 'Copper and cold well water', 'Dust and wild rosemary'],
      atmosphere: 'Ancient, sacred, quietly dangerous, saturated with forgotten memory.',
    },
    'romantasy': {
      title: 'Romantasy & High Stakes Longing',
      sight: ['Candlelight reflecting in dark irises', 'The subtle pulse in a hollow throat', 'Shadows blending at the balcony rim'],
      sound: ['A breath caught in the dark', 'Silk rustling across marble', 'The sharp click of a sheathed blade'],
      scent: ['Crushed night-blooming jasmine', 'Leather saddlebags and rain-damp wool', 'Spiced pomegranate and smoke'],
      touch: ['The shock of skin against cold armor', 'Calloused fingers tracing a jawline', 'Velvet heavy with winter damp'],
      taste: ['Dark spiced wine', 'Blood and winter mint', 'Crystallized ginger'],
      atmosphere: 'Electric, intimate, fraught with forbidden stakes and sharp longing.',
    },
    'sci-fi-speculative': {
      title: 'Sci-Fi & Speculative Space',
      sight: ['Monochromatic HUD reflections on visor glass', 'Stuttering neon amber through fog', 'Cold starlight through vacuum shields'],
      sound: ['The low 60Hz hum of cryo-coolers', 'The sharp hiss of hydraulic seals', 'Synthetic chime of terminal telemetry'],
      scent: ['Recirculated cabin air and hot circuits', 'Ionized ozone and cooling fluid', 'Metallic sharpness of sealed suits'],
      touch: ['Matte carbon-fiber composites', 'The vibration of sub-light thrusters', 'Thermal gloves against cryogenic frost'],
      taste: ['Electrolyte paste with synthetic citrus', 'Distilled recycled hydration', 'Metallic tang of dry oxygen'],
      atmosphere: 'Vast, clinical, high-stakes isolation against cosmic indifference.',
    },
    'gothic-thriller': {
      title: 'Gothic Thriller & Manor Mystery',
      sight: ['Candle flames guttering in sudden draughts', 'Black oil-portraits with cracked varnish', 'Fog clinging to iron cemetery gates'],
      sound: ['The slow drip of condensation behind wallpaper', 'Muffled footsteps on floorboards overhead', 'A grandfather clock missing its pendulum beat'],
      scent: ['Damp plaster and dried lavender', 'Stagnant pond water and beeswax candles', 'Decaying autumn leaves'],
      touch: ['Damp velvet drapes', 'Cold brass doorknobs resisting turning', 'Cobwebs brushing an unwary cheek'],
      taste: ['Black tea steeped too long', 'Paraffin wax and cold broth', 'The sour iron of sudden fear'],
      atmosphere: 'Claustrophobic, dread-laden, haunted by the repressed past.',
    },
    'nonfiction-authority': {
      title: 'Nonfiction & Master Architecture',
      sight: ['Crisp typographic charts with clean negative space', 'Annotated manuscript margins in sharp graphite', 'Calm morning light across a cedar desk'],
      sound: ['The decisive strike of mechanical keys', 'The clean turn of heavy 100gsm paper', 'Focused stillness before an insight'],
      scent: ['Freshly brewed single-origin espresso', 'Linen rag paper and fountain pen ink', 'Rain on warm pavement outside the study window'],
      touch: ['Smooth leather-bound notebook', 'The solid heft of a fountain pen', 'The satisfying snap of a closed binder'],
      taste: ['Bright citrus acidity of morning roast', 'Crisp sparkling mineral water', 'Dark chocolate with sea salt'],
      atmosphere: 'Clear, authoritative, grounded in empirical evidence and intellectual rigor.',
    },
  };

  const current = palettes[selectedGenre] || palettes['mythic-fantasy'];

  return (
    <section className="sensory-palette-panel" aria-label="Sensory Texture Palettes">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Visceral Immersion</span>
          <h2>🎨 5-Sense Texture Palette & Atmosphere</h2>
        </div>
        <div className="genre-select-tabs" role="tablist">
          {Object.keys(palettes).map(key => (
            <button
              key={key}
              type="button"
              className={`tab-btn ${selectedGenre === key ? 'active' : ''}`}
              onClick={() => setSelectedGenre(key)}
            >
              {palettes[key].title.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="palette-card">
        <div className="palette-header">
          <h3>{current.title}</h3>
          <p className="atmosphere-banner">🌌 <strong>Atmosphere:</strong> {current.atmosphere}</p>
        </div>

        <div className="senses-grid">
          <div className="sense-box sense-sight">
            <h4>👁️ Sight</h4>
            <ul>
              {current.sight.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>

          <div className="sense-box sense-sound">
            <h4>👂 Sound</h4>
            <ul>
              {current.sound.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>

          <div className="sense-box sense-scent">
            <h4>👃 Scent</h4>
            <ul>
              {current.scent.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>

          <div className="sense-box sense-touch">
            <h4>✋ Touch</h4>
            <ul>
              {current.touch.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>

          <div className="sense-box sense-taste">
            <h4>👅 Taste</h4>
            <ul>
              {current.taste.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
