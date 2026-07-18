# Joe's PF2e Stuff

A personal FoundryVTT module containing Joe's collection of Pathfinder 2e compendiums, macros, and quality-of-life scripts.

> [!NOTE] 
> This is a personal module.** It's shared mainly so others can reuse the scripts and features, and is provided as-is with no support or update guarantees. The **compendium content ships without images**: image paths in the compendium items point to art I don't redistribute, so scenes/items/etc. will appear blank or with broken image links. The scripts and functionality work fully regardless; swap in your own art as needed.

**Compatibility:** FoundryVTT v13-v14 &nbsp;|&nbsp; **System:** Pathfinder Second Edition (`pf2e`)

---

## Features

### Recall Knowledge Assistant
A guided, GM-mediated Recall Knowledge flow. A player targets a creature and runs the macro (`game.modules.get("joes-pf2e-stuff").api.recallKnowledgeMacro()`); with a target it hands the actual roll to the PF2e Workbench Recall Knowledge macro (blind roll, skill detection, DCs). The GM then gets an outcome dialog showing the rolled results, the creature's applicable skills (mapped from its traits) with the character's modifiers, and the character's Lore skills, and picks the result to relay:

- **Critical Success** - player picks **two** pieces of information.
- **Success** - player picks **one**.
- **Failure** - player is told they recall nothing useful.
- **Critical Failure** - GM can feed **plausible but false** information (auto-generated), send a blank "draws a blank" message, or dismiss.

Players choose what to learn from a menu: Weaknesses & Resistances, Immunities, Traits, Lowest/Highest Save, or a free-form **General Question** to the GM (with a GM reply dialog). Detects blind RK rolls from the PF2e system, PF2e Workbench, PF2e HUD, and Basic Action Macro. With no target, the macro just opens the "Ask the GM" question dialog.

*Optional integrations: PF2e Workbench (required to roll against a target), PF2e HUD, Basic Action Macro.*

### NPC at 0 HP
When a non-player-character actor drops to 0 HP, its tokens are automatically handled per the **NPC at 0 hp** setting: **Hide Token**, **Blood Splash** (requires Token Magic FX), or **Disabled**. Tokens are un-hidden and the splash effect cleared automatically when the actor is healed above 0.

*Optional integration: Token Magic FX (for the blood splash option).*

### Hero Points
GM macro (`api.heroPointMacro()`) to award Hero Points to every member of the active Party, with a dialog to choose the amount (0-3) and whether to **Add** or **Set**. Posts a themed "Heroic Inspiration" chat card summarizing who got what, and (on Add) shows a celebratory image to all connected players. If PF2e Toolbelt is active, it also draws Hero Actions for each affected actor. A hook also shows the configured image whenever a "hero points reset/added" message appears in chat.

*Optional integration: PF2e Toolbelt (draws Hero Actions).*

### Image Handout Sender
Send a centered image to selected connected players for a set duration (5/10/15 seconds). Exposed via the module API (`api.sendImageDialog()` opens the picker; `api.showImageDialog(url, duration, title)` shows one directly). Distributed to the chosen clients over the module socket.

### Kingmaker Hex Tool Memory
Remembers the Kingmaker hex-map tool toggle state per user and restores it when the canvas reloads, so it isn't lost on every scene change. Also tracks the colored/icons overlay layer when the Kingmaker Helper module is present. Macro helpers: `api.toggleKingmakerHexTools()` and `api.restoreKingmakerHexTools()`.

*Optional integrations: pf2e-kingmaker, pf2e-kingmaker-helper.*

### Error Logger
Captures player-side `ui.notifications` errors (and warnings) into a shared **Error Logs** journal, one page per player, so the GM can review issues players hit. Attempts to resolve any 16-character document ID found in a message to its named document. Console helpers: `game.joesFoundryStuff.getCapturedLogs()` and `game.joesFoundryStuff.clearCapturedLogs()`.

---

## Settings

All settings live under **Configure Settings -> Module Settings -> Joe's PF2e Stuff**:

| Setting | Scope | Description |
|---|---|---|
| **Send Image when adding Hero Points** | World | Auto-show the Hero Point image when Hero Points are added/reset. |
| **Hero Point Image Path** | World | Path to the image shown on Hero Point award/reset. |
| **Enable Error Logger** | World | Capture player errors into the "Error Logs" journal. |
| **NPC at 0 hp** | World | What to do with an NPC token at 0 HP: Hide Token / Blood Splash* / Disabled. *Blood Splash requires Token Magic FX. |
| **Hide Effects Panel** | Client | Apply the override CSS that hides the effects panel icons and repositions the panel. Per-client, applies live without a reload. |
| **Debug Level** | World | Console logging verbosity: None / Errors / Warning + Errors / All. |

---

## Module API

Available at `game.modules.get("joes-pf2e-stuff").api`:

| Method | Purpose |
|---|---|
| `recallKnowledgeMacro()` | Start the Recall Knowledge flow (target a creature first, or open the question dialog). |
| `heroPointMacro()` | GM: award/set Hero Points for the party. |
| `sendImageDialog()` | GM: open the "send a centered image to players" dialog. |
| `showImageDialog(url, duration, title)` | Show a centered image locally. |
| `toggleKingmakerHexTools()` | Toggle the Kingmaker hex map tool. |
| `restoreKingmakerHexTools()` | Restore the saved hex tool state. |

---

## Compendiums

| Pack | Type |
|------|------|
| Joe's Actors (pf2) | Actors |
| Joe's Items (pf2e) | Items |
| Joe's Journals (pf2e) | Journal Entries |
| Joe's PF2E Adventures | Adventures |
| Joe's Error Logs | Journal Entries |

---

## Installation

Manifest URL:
```
https://raw.githubusercontent.com/thejoester/joes-pf2e-stuff/main/module.json
```

Requires the **Pathfinder Second Edition** system.

---

## Author

**TheJoester** - Discord: `thejoester`
