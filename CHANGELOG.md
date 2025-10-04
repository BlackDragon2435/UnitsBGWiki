Changelog - UnitsBGWiki

2025-10-03 - Mod & stat calculation improvements

- Updated: `Staging/script.js`
  - Improved mod application heuristics:
    - HP and Damage mods now interpret `Amount` intelligently: treat values <= 2 as decimal multipliers (e.g., 0.1 => +10%), and larger values as percent points (e.g., 10 => +10%).
    - Cooldown mods are treated multiplicatively (e.g., -0.1 => 10% faster cooldown) with a minimum cooldown clamp to prevent zero/negative cooldowns.
  - Removed direct modification of `DPS` by mods. DPS is always recalculated after Damage and Cooldown changes using DPS = Damage / Cooldown.
  - Enhanced unit detail UI to show level-adjusted base stats and deltas when mods are applied (absolute and percent changes).

- Added: `CHANGELOG.md` (this file)

Assumptions & Notes
- The repository includes the Roblox place file `BasePlaceIGNORE/UnitsBG.rbxlx`, but it is a large binary/XML and couldn't be opened fully in this environment. Because of that, I inferred and mirrored in-game formulas using the site's existing `gameData.js` and `Staging/script.js` logic plus reasonable heuristics.
- Key heuristics used:
  - Percent-based mod amounts are typically decimals (0.1 => 10%). If the Amount is a whole large number (like 10), it is treated as percent points (10 => 10%).
  - Cooldown mods are multiplicative, not additive.
  - DPS formula is Damage / Cooldown (confirmed in `Staging/script.js`).

Next Steps for 100% parity
1. Extract actual Lua script sources from the Roblox place file (ModuleScripts or Script.Source contents). If you can provide the raw Lua script text (or export the scripts), I will parse them and replace heuristics with exact formulas.
2. Add unit tests simulating representative mods and units to assert parity.
3. Add server-side caching or precomputed JSON for heavy data to speed up page load.

If you want, I can continue by:
- Attempting to extract embedded script text from the `.rbxlx` by converting it to plain XML outside this environment, or
- If you provide the Lua script files (as text), I will perform a definitive mapping and update the site logic accordingly.
