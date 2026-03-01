# Project: Kid's Vibe-Coding Game Session

## What We're Doing

A 5-year-old child is "vibe coding" a game by describing what they want in plain language. An adult is typing the prompts. The child is learning to give clear instructions to an LLM — not learning to code. Fun and fast visual results are the priority.

## The Game Concept

A pseudo-3D scrolling game in a single HTML file:

- A **player character** (superhero sprite) sits at the bottom of the screen and moves left/right
- **Objects scroll from the top of the screen downward** toward the player
- Objects **scale up as they descend** (small at top, large at bottom), creating a 3D "rushing toward you" effect
- Some objects are **collectibles** (good — gain points), some are **obstacles** (bad — lose a life or end game)
- The child chooses what the objects are, what the hero looks like, and how the game behaves

## Technical Constraints — READ THESE CAREFULLY

1. **Single HTML file only.** Everything — HTML, CSS, JS — goes in one `index.html`. No build tools, no frameworks, no dependencies, no imports.
2. **Vanilla JavaScript + Canvas API.** Use `<canvas>` for all rendering. No libraries.
3. **Emoji for all sprites.** No image assets. The hero, collectibles, and obstacles are all drawn as emoji on the canvas using `ctx.font` and `ctx.fillText()`. This makes it trivial to swap visuals ("make the hero a dinosaur" → change one emoji character).
4. **Keep it simple and hackable.** The code should be easy to modify in small, isolated ways. Use clearly named variables at the top of the script for things the child might want to change:
   - `HERO_EMOJI` — the player character emoji
   - `GOOD_ITEMS` — array of `{ emoji, points }` for collectibles
   - `BAD_ITEMS` — array of `{ emoji }` for obstacles
   - `SPAWN_RATE` — how often objects appear
   - `GAME_SPEED` — how fast objects scroll
   - `BACKGROUND_COLOR` — canvas background
   - `LIVES` — starting lives
5. **The 3D scroll effect** works like this:
   - Objects spawn at a random X near the horizontal center (converging toward a vanishing point at roughly `canvas.width / 2`)
   - As Y increases (moving down screen), objects scale up: `scale = 0.3 + (y / canvasHeight) * 1.2`
   - As Y increases, X position interpolates outward from center toward the object's assigned "lane" position — this creates the spreading/perspective effect
   - The emoji font size is multiplied by the scale factor
6. **Controls:** Left/Right arrow keys to move the hero. Also support A/D keys. On touch devices, tapping left/right half of screen should also work.
7. **Collision detection:** Simple distance-based check between the player position and each object's position, adjusted for scale. Doesn't need to be pixel-perfect — generous hit boxes feel better for a small child.
8. **Game state:** Show score prominently on screen. Show lives as emoji hearts. When lives run out, show a "Game Over" screen with the score and a "Play Again" button. Keep it encouraging — "Amazing! You scored 42!"
9. **No game-over on first hit.** Start with 3 lives so the child doesn't get frustrated immediately.
10. **Sound:** No sound unless explicitly asked for. If asked, use the Web Audio API to generate simple beeps/boops — no audio file dependencies.

## How to Handle Requests

The child's prompts will be informal and imaginative. Interpret them generously:

- "Make it faster" → increase `GAME_SPEED`
- "Add a dragon" → add a dragon emoji to either `GOOD_ITEMS` or `BAD_ITEMS` (ask which, or default to obstacle)
- "Make the background space" → dark background with small white dots drawn as stars
- "Add explosions" → when hitting a bad item, briefly render a 💥 emoji at that position
- "I want a unicorn hero" → change `HERO_EMOJI` to 🦄
- "Make it rain" → add visual rain effect (simple falling lines or 💧 emoji in background layer)
- "Add a boss" → periodically spawn a larger, slower obstacle that takes multiple hits or is worth more points to dodge

When modifying the game, **change only what was asked for** and leave everything else working. Don't refactor or reorganize unprompted. The child needs to see that their specific instruction caused a specific change.

## Visual Design Defaults

- Canvas fills the full browser viewport
- Dark blue or black background (looks more dramatic and game-like)
- Score text in white, large and readable
- Lives shown as a row of ❤️ in the top corner
- Objects should have a slight visual variety in spawn timing so it doesn't feel mechanical
- The hero emoji should be noticeably larger than the objects for visual clarity

## First Run

If asked to "make the game" or "start" or given a vague initial prompt, generate a complete working game with these defaults:
- Hero: 🦸
- Good items: ⭐ (10 pts), 💎 (25 pts)
- Bad items: 💣, 🔥
- 3 lives, moderate speed
- Dark background
- Score and lives display
- Game over screen with restart

This gives the child something fun immediately, which they can then customize.

## Code Style

- Generous comments explaining what each section does (the adult may read these)
- All tunable constants grouped at the very top of the `<script>` block
- Game loop using `requestAnimationFrame`
- Keep total code under 250 lines if possible — this is a toy, not a product
