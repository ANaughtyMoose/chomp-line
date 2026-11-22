# Chomp Line

A 2026 winter snow-globe diorama alpine escape game inspired by *SkiFree* (1991), built with **Three.js**, **WebGL post-processing shaders**, **HD-2D handcrafted stop-motion diorama assets**, and a **dynamic speed-coupled Web Audio Christmas soundtrack**.

## Run Locally

```bash
npm install
npm run dev
```

Then open **http://localhost:5173/**.

## Controls
- **Mouse / Trackpad** or **`← →` / `A D`**: Carve & steer (carve hard to charge Carve Slingshot, snap back to burst)
- **`Space`**: Jump & hold in mid-air to spin tricks (release before landing for Perfect Stomp)
- **`F` / `Shift` / Left-Click**: Flow Boost
- **`E`**: Drop Decoy Snowman (when equipped)
- **`M` / `N`**: Toggle Music / Sound FX
- **`P` / `Esc`**: Pause

## Architecture
- `src/game/game.ts` — Core physics, accelerating downhill loop, Carve Slingshot, rail grinds, ice drift, multi-phase Yeti encounters, and camera FOV juice
- `src/game/sprites.ts` — HD-2D stop-motion diorama cutout loader, grounded contact shadows, warm snow light-pools, foreground bokeh framing, and interactive 3D props
- `src/game/puppetShader.ts` — Clean vertex-shader scarf-tip flutter & whole-body spring squash/stretch (preserving crisp undistorted character expressions)
- `src/game/shaders.ts` — Aurora Borealis twilight horizon shader + macro tilt-shift snow-globe post-processing pass
- `src/game/snowTrail.ts` — Endless ring-buffer 1024×1024 glossy sapphire ski-trench & Yeti footprint trail canvas
- `src/game/audio.ts` — Speed-accelerating major-key public-domain Christmas soundtrack (*Jingle Bells*, *Deck the Halls*, *Trepak*) + tactile alpine carving/wind SFX
- `src/game/upgrades.ts` — Synergistic mountain lodge gear draft system
