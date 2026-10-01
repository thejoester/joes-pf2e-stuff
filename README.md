# Joe's PF2e Stuff

A personal FoundryVTT module containing Joe's collection of Pathfinder 2e quality-of-life scripts and features.

> [!NOTE]
> This is a personal module. It's shared mainly so others can reuse the scripts and features, and is provided as-is with no support or update guarantees.

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
GM macro (`api.heroPointMacro()`) to award Hero Points to every member of the active Party, with a dialog to choose the amount (0-3) and whether to **Add** or **Set**. Posts a themed "Heroic Inspiration" chat card summarizing who got what, and (on Add) shows a random celebratory image from the configured **Hero Point Image Folder** to all connected players. If PF2e Toolbelt is active, it also draws Hero Actions for each affected actor.

*Optional integration: PF2e Toolbelt (draws Hero Actions).*

### Image Handout Sender
Send a centered image to selected connected players for a set duration (5/10/15 seconds). Exposed via the module API (`api.sendImageDialog()` opens the picker; `api.showImageDialog(url, duration, title)` shows one directly). Distributed to the chosen clients over the module socket.

### Kingmaker Hex Tool Memory
Remembers the Kingmaker hex-map tool toggle state per user and restores it when the canvas reloads, so it isn't lost on every scene change. Also tracks the colored/icons overlay layer when the Kingmaker Helper module is present. Macro helpers: `api.toggleKingmakerHexTools()` and `api.restoreKingmakerHexTools()`.

*Optional integrations: pf2e-kingmaker, pf2e-kingmaker-helper.*

---

## Settings

All settings live under **Configure Settings -> Module Settings -> Joe's PF2e Stuff**:

| Setting | Scope | Description |
|---|---|---|
| **Send Image when adding Hero Points** | World | When enabled, adding Hero Points shows a random image from the folder to players. |
| **Hero Point Image Folder** | World | Folder of images; a random one is shown to players when Hero Points are added. |
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

This module no longer ships compendium content, it is scripts and functionality only. Joe's personal PF2e compendiums (actors, items, journals, adventures) now live in the separate private `joes-compendiums` module.

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
