console.log("%cJoe's PF2e Stuff | recall-knowledge.js loaded", "color: yellow; font-weight: bold;");

const MODULE_ID     = "joes-pf2e-stuff";
const MODULE_SOCKET = "module.joes-pf2e-stuff";

// Stores pending RK creature UUIDs on the GM client, keyed by rolling user ID.
const _rkPending = {};

// Collects RK roll results per user within a short window (multiple messages
// arrive when workbench/HUD rolls several skills at once). Keyed by user ID.
const _rkCollecting = {};

// ─── Data ─────────────────────────────────────────────────────────────────────

const TRAIT_SKILL_MAP = {
	aberration:  ["arcana", "occultism"],
	animal:      ["nature"],
	astral:      ["occultism"],
	beast:       ["arcana", "nature"],
	celestial:   ["religion"],
	construct:   ["arcana", "crafting"],
	dragon:      ["arcana"],
	elemental:   ["arcana", "nature"],
	ethereal:    ["occultism"],
	fey:         ["nature", "occultism"],
	fiend:       ["religion"],
	fungus:      ["nature"],
	humanoid:    ["society"],
	monitor:     ["occultism", "religion"],
	ooze:        ["occultism"],
	plant:       ["nature"],
	spirit:      ["occultism"],
	undead:      ["religion", "occultism"],
};

const SKILL_LABELS = {
	arcana:    "Arcana",
	crafting:  "Crafting",
	nature:    "Nature",
	occultism: "Occultism",
	religion:  "Religion",
	society:   "Society",
};

// Standard difficulty DCs by creature level (PF2e Remaster)
const RK_DC_BY_LEVEL = {
	"-1": 13, "0": 14,  "1": 15,  "2": 16,  "3": 18,  "4": 19,
	 "5": 20, "6": 22,  "7": 23,  "8": 24,  "9": 26, "10": 27,
	"11": 28, "12": 30, "13": 31, "14": 32, "15": 34, "16": 35,
	"17": 36, "18": 38, "19": 39, "20": 40, "21": 42, "22": 44,
	"23": 46, "24": 48,
};

const INFO_OPTIONS = [
	{ value: "weaknesses",  label: "Weaknesses & Resistances" },
	{ value: "immunities",  label: "Immunities"               },
	{ value: "traits",      label: "Traits"                   },
	{ value: "lowestSave",  label: "Lowest Save"              },
	{ value: "highestSave", label: "Highest Save"             },
	{ value: "question",    label: "General Question..."      },
];

// Creature traits used to generate plausible-but-false trait misinformation
const MONSTER_TRAITS = [
	"aberration", "amphibious", "animal", "aquatic", "astral", "beast",
	"celestial", "construct", "daemon", "demon", "devil", "dragon",
	"elemental", "ethereal", "fey", "fiend", "fungus", "giant",
	"humanoid", "incorporeal", "mindless", "monitor", "ooze", "plant",
	"protean", "psychopomp", "skeleton", "spirit", "swarm", "undead",
	"vampire", "zombie",
];

const DAMAGE_TYPES = [
	"acid", "bludgeoning", "cold", "electricity", "fire", "force",
	"mental", "negative", "piercing", "positive", "slashing", "sonic",
	"spirit", "vitality", "void",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _rkPickRandom(arr, n = 1) {
	const shuffled = [...arr].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, n);
}

function _rkApplicableSkills(creatureActor) {
	const traits = creatureActor.system?.traits?.value ?? [];
	const skills = new Set();
	for (const trait of traits) {
		const mapped = TRAIT_SKILL_MAP[trait];
		if (mapped) mapped.forEach(s => skills.add(s));
	}
	// Fallback: all standard RK skills if no traits matched
	if (skills.size === 0) Object.keys(SKILL_LABELS).forEach(s => skills.add(s));
	return [...skills];
}

function _rkDC(creatureActor) {
	const level = creatureActor.system?.details?.level?.value ?? 0;
	return RK_DC_BY_LEVEL[String(level)] ?? (15 + level);
}

function _rkFormatInfo(actor, selection) {
	switch (selection) {
		case "weaknesses": {
			const w = actor.system.attributes.weaknesses ?? [];
			const r = actor.system.attributes.resistances ?? [];
			if (!w.length && !r.length) return `<strong>${actor.name}</strong> has no weaknesses or resistances.`;
			const parts = [];
			const fmtWR = x => {
				const excArr = Array.isArray(x.exceptions) ? x.exceptions : (x.exceptions ? [x.exceptions] : []);
				const exc = excArr.length > 1
					? excArr.slice(0, -1).join(", ") + ", or " + excArr.at(-1)
					: excArr[0] ?? "";
				return exc ? `${x.type} (except ${exc})` : x.type;
			};
			if (w.length) parts.push(`<strong>Weaknesses:</strong> ${w.map(fmtWR).join(", ")}`);
			if (r.length) parts.push(`<strong>Resistances:</strong> ${r.map(fmtWR).join(", ")}`);
			return parts.join("<br>");
		}
		case "immunities": {
			const imm = actor.system.attributes.immunities ?? [];
			if (!imm.length) return `<strong>${actor.name}</strong> has no immunities.`;
			return `<strong>Immunities:</strong> ${imm.map(x => x.type).join(", ")}`;
		}
		case "traits": {
			const traits = actor.system.traits?.value ?? [];
			if (!traits.length) return `<strong>${actor.name}</strong> has no notable traits.`;
			return `<strong>Traits:</strong> ${traits.join(", ")}`;
		}
		case "lowestSave": {
			const saves = {
				Fortitude: actor.system.saves.fortitude.value,
				Reflex:    actor.system.saves.reflex.value,
				Will:      actor.system.saves.will.value,
			};
			const [saveName] = Object.entries(saves).sort((a, b) => a[1] - b[1])[0];
			return `<strong>Lowest Save:</strong> ${saveName}`;
		}
		case "highestSave": {
			const saves = {
				Fortitude: actor.system.saves.fortitude.value,
				Reflex:    actor.system.saves.reflex.value,
				Will:      actor.system.saves.will.value,
			};
			const [saveName] = Object.entries(saves).sort((a, b) => b[1] - a[1])[0];
			return `<strong>Highest Save:</strong> ${saveName}`;
		}
		default:
			return null;
	}
}

// Generates plausible but incorrect information for a critical failure.
function _rkFormatFalseInfo(actor, selection) {
	switch (selection) {
		case "weaknesses": {
			const w = actor.system.attributes.weaknesses ?? [];
			const r = actor.system.attributes.resistances ?? [];
			const actualTypes = new Set([...w, ...r].map(x => x.type));
			const fakePool = DAMAGE_TYPES.filter(t => !actualTypes.has(t));
			if (w.length || r.length) {
				// Creature has real weaknesses/resistances — either deny them or invert one
				if (Math.random() < 0.5) {
					return `<strong>${actor.name}</strong> has no weaknesses or resistances.`;
				}
				// Pick a real weakness and present it as a resistance (or vice versa)
				if (w.length) {
					const flipped = w[Math.floor(Math.random() * w.length)];
					return `<strong>Resistances:</strong> ${flipped.type}`;
				}
				const flipped = r[Math.floor(Math.random() * r.length)];
				return `<strong>Weaknesses:</strong> ${flipped.type}`;
			}
			// Creature has none — invent a fake weakness
			const [fakeType] = _rkPickRandom(fakePool, 1);
			return `<strong>Weaknesses:</strong> ${fakeType}`;
		}

		case "immunities": {
			const imm = actor.system.attributes.immunities ?? [];
			if (imm.length) {
				if (Math.random() < 0.5) {
					return `<strong>${actor.name}</strong> has no immunities.`;
				}
				// Pick a wrong damage type
				const actualTypes = new Set(imm.map(x => x.type));
				const fakePool = DAMAGE_TYPES.filter(t => !actualTypes.has(t));
				const [fakeType] = _rkPickRandom(fakePool, 1);
				return `<strong>Immunities:</strong> ${fakeType}`;
			}
			const [fakeType] = _rkPickRandom(DAMAGE_TYPES, 1);
			return `<strong>Immunities:</strong> ${fakeType}`;
		}

		case "lowestSave": {
			// Return the highest save instead
			const saves = {
				Fortitude: actor.system.saves.fortitude.value,
				Reflex:    actor.system.saves.reflex.value,
				Will:      actor.system.saves.will.value,
			};
			const [saveName] = Object.entries(saves).sort((a, b) => b[1] - a[1])[0];
			return `<strong>Lowest Save:</strong> ${saveName}`;
		}

		case "highestSave": {
			// Return the lowest save instead
			const saves = {
				Fortitude: actor.system.saves.fortitude.value,
				Reflex:    actor.system.saves.reflex.value,
				Will:      actor.system.saves.will.value,
			};
			const [saveName] = Object.entries(saves).sort((a, b) => a[1] - b[1])[0];
			return `<strong>Highest Save:</strong> ${saveName}`;
		}

		case "traits": {
			const actualTraits = new Set(actor.system.traits?.value ?? []);
			const fakePool = MONSTER_TRAITS.filter(t => !actualTraits.has(t));
			const count = Math.random() < 0.5 ? 1 : 2;
			const fakeTraits = _rkPickRandom(fakePool, count);
			return `<strong>Traits:</strong> ${fakeTraits.join(", ")}`;
		}

		default:
			return null;
	}
}

// ─── Roll result helpers ──────────────────────────────────────────────────────

function _rkComputeOutcome(total, dc) {
	const diff = total - dc;
	if (diff >= 10)  return { label: "Critical Success", color: "#4caf50" };
	if (diff >= 0)   return { label: "Success",          color: "#2196f3" };
	if (diff >= -10) return { label: "Failure",          color: "#ff9800" };
	return               { label: "Critical Failure",    color: "#f44336" };
}

// Try to extract the rolled skill name from a chat message.
function _rkExtractSkillName(msg) {
	const ctx = msg.flags?.pf2e?.context;

	// PF2e system/workbench: check context.skill directly
	if (ctx?.skill?.label) return ctx.skill.label;
	if (ctx?.skill?.slug)  return SKILL_LABELS[ctx.skill.slug] ?? ctx.skill.slug;

	// PF2e system/workbench: check context.domains for a known skill slug
	if (ctx?.domains) {
		const known = new Set(Object.keys(SKILL_LABELS));
		const found = ctx.domains.find(d => known.has(d));
		if (found) return SKILL_LABELS[found];
	}

	// PF2e HUD: span has extra attributes (data-tooltip etc) so match loosely
	if (msg.flavor?.includes("pf2e-hud-rk")) {
		const match = msg.flavor.match(/<span\s[^>]*class="name[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/);
		if (match) return match[1].trim();
	}

	// BAM: skill name is in the vertical-align:middle row header
	if (msg.content?.includes("<strong>Recall Knowledge</strong>")) {
		const match = msg.content.match(/<tr style="vertical-align:middle">\s*<th[^>]*>([^<]+)<\/th>/);
		if (match) return match[1].trim();
	}

	// Workbench fallback: scan message content for known skill labels in HTML
	if (msg.content) {
		for (const label of Object.values(SKILL_LABELS)) {
			if (msg.content.includes(`>${label}<`) || msg.content.includes(`>${label} `)) {
				return label;
			}
		}
	}

	return null;
}

// ─── Question dialog (no-target path + "General Question" selection) ──────────

async function _rkQuestionDialog(opts = {}) {
	const placeholder = opts.creatureName
		? `Ask the GM about ${opts.creatureName}...`
		: "Ask the GM a question about a creature or ability...";

	let question;
	try {
		question = await new Promise((resolve, reject) => {
			new foundry.applications.api.DialogV2({
				window: { title: "Ask the GM" },
				content: `
					<form>
						<div class="form-group">
							<textarea name="question" rows="3"
								placeholder="${placeholder}"
								style="width:100%;resize:vertical;"></textarea>
						</div>
					</form>
				`,
				buttons: [
					{
						action:   "send",
						label:    "Send",
						default:  true,
						callback: (_e, btn) => btn.form.elements.question.value.trim(),
					},
					{ action: "cancel", label: "Cancel" },
				],
				submit:      result => { if (result === "cancel" || !result) reject(new Error("canceled")); else resolve(result); },
				rejectClose: true,
			}).render({ force: true });
		});
	} catch { return; }

	game.socket.emit(MODULE_SOCKET, {
		command:       "rkQuestion",
		question,
		userId:        game.user.id,
		characterName: game.user.character?.name ?? game.user.name,
		creatureName:  opts.creatureName ?? null,
	});
	ui.notifications.info("Your question has been sent to the GM.");
}

// ─── GM: reply to player question ────────────────────────────────────────────

async function _rkGMReplyDialog({ question, userId, characterName, creatureName }) {
	const ctx = creatureName ? ` (about <em>${creatureName}</em>)` : "";
	let reply;
	try {
		reply = await new Promise((resolve, reject) => {
			new foundry.applications.api.DialogV2({
				window: { title: `Question from ${characterName}` },
				content: `
					<form>
						<p><strong>${characterName}</strong> asks${ctx}:</p>
						<blockquote style="margin:0.5em 0;padding:0.5em;border-left:3px solid var(--color-border-dark);">${question}</blockquote>
						<div class="form-group" style="margin-top:0.5em;">
							<label>Reply:</label>
							<textarea name="reply" rows="3" style="width:100%;resize:vertical;"></textarea>
						</div>
					</form>
				`,
				buttons: [
					{
						action:   "send",
						label:    "Send Reply",
						default:  true,
						callback: (_e, btn) => btn.form.elements.reply.value.trim(),
					},
					{ action: "dismiss", label: "Dismiss" },
				],
				submit:      result => { if (!result || result === "dismiss") reject(new Error("dismissed")); else resolve(result); },
				rejectClose: false,
			}).render({ force: true });
		});
	} catch { return; }

	if (!reply) return;
	ChatMessage.create({ content: `<em>(GM)</em> ${reply}`, whisper: [userId] });
}

// For PF2e HUD and BAM rolls, the message roll object only contains a bare 1d20.
// The modifier-included total lives in the flavor/content HTML instead.
function _rkExtractRollTotal(msg) {
	if (msg.flavor?.includes("pf2e-hud-rk")) {
		const match = msg.flavor.match(/<span class="(?:success|failure) ">(\d+)<\/span>/);
		if (match) return parseInt(match[1], 10);
	}
	if (msg.content?.includes("<strong>Recall Knowledge</strong>")) {
		const match = msg.content.match(/<tr style="vertical-align:middle">[\s\S]*?<span style="color:royalblue;text-align:center">(\d+)<\/span>/);
		if (match) return parseInt(match[1], 10);
	}
	return msg.rolls?.[0]?.total ?? null;
}

// ─── GM: outcome dialog (triggered by createChatMessage hook) ─────────────────

// collected: { entries: [{skillName, rollTotal, dc, outcome}], rollingUser, characterName, firstMsg }
async function _rkGMOutcomeDialog(collected, creatureActor) {
	const { entries, rollingUser, characterName, firstMsg } = collected;

	// Resolve character actor
	const characterActor = canvas.tokens.get(firstMsg?.speaker?.token)?.actor
		?? game.actors.get(firstMsg?.speaker?.actor)
		?? rollingUser?.character
		?? game.actors.getName(characterName);

	// Applicable skills with character modifiers
	const applicableSlugs = _rkApplicableSkills(creatureActor);

	// Roll results — only show applicable skills, not lore rolls
	const dc = _rkDC(creatureActor);
	const rollRows = entries
		.filter(e => !e.skillName || !e.skillName.toLowerCase().endsWith("lore"))
		.map(e => {
			const label  = e.skillName ?? "Unknown Skill";
			const result = _rkComputeOutcome(e.rollTotal, dc);
			return `<li><strong>${label}:</strong> rolled ${e.rollTotal} vs DC ${dc} — <span style="color:${result.color};font-weight:bold;">${result.label}</span></li>`;
		}).join("");
	const rollsHtml = `<div style="margin-top:0.5em;"><strong>Results:</strong><ul style="margin:0.25em 0 0 1em;padding:0;">${rollRows}</ul></div>`;
	const applicableItems = applicableSlugs.map(slug => {
		const skill = characterActor?.skills?.[slug];
		const mod   = skill?.check?.mod ?? skill?.totalModifier ?? 0;
		const modStr = characterActor ? ` (${mod >= 0 ? "+" : ""}${mod})` : "";
		return `<li>${SKILL_LABELS[slug] ?? slug}${modStr}</li>`;
	});
	const applicableHtml = `<div style="margin-top:0.5em;"><strong>Applicable Skills:</strong><ul style="margin:0.25em 0 0 1em;padding:0;">${applicableItems.join("")}</ul></div>`;

	// Lore skills
	const loreItems = characterActor
		? Object.entries(characterActor.skills ?? {})
			.filter(([slug]) => slug.endsWith("-lore"))
			.map(([, skill]) => {
				const mod = skill.check?.mod ?? skill.totalModifier ?? 0;
				return `<li>${skill.label} (${mod >= 0 ? "+" : ""}${mod})</li>`;
			})
		: [];
	const loreHtml = `<div style="margin-top:0.5em;"><strong>Lore Skills:</strong>${
		loreItems.length
			? `<ul style="margin:0.25em 0 0 1em;padding:0;">${loreItems.join("")}</ul>`
			: `<span style="margin-left:0.5em;font-style:italic;">None</span>`
	}</div>`;

	const outcome = await new Promise(resolve => {
		new foundry.applications.api.DialogV2({
			window: { title: "Recall Knowledge — Outcome" },
			content: `
				<p>
					<strong>${characterName}</strong> rolled a Recall Knowledge check
					vs. <strong>${creatureActor.name}</strong>.
				</p>
				${rollsHtml}
				${loreHtml}
				<p style="margin-top:0.5em;">Select the outcome to relay to the player:</p>
			`,
			buttons: [
				{ action: "critSuccess", label: "Critical Success" },
				{ action: "success",     label: "Success"          },
				{ action: "failure",     label: "Failure"          },
				{ action: "critFailure", label: "Critical Failure" },
				{ action: "dismiss",     label: "Dismiss"          },
			],
			submit:      result => resolve(result),
			rejectClose: false,
		}).render({ force: true });
	});

	if (!outcome || outcome === "dismiss" || !rollingUser) return;

	if (outcome === "failure") {
		ChatMessage.create({
			content: `<em>${characterName} doesn't recall anything useful about this creature.</em>`,
			whisper: [rollingUser.id],
		});
		return;
	}

	if (outcome === "critFailure") {
		const deceiveChoice = await new Promise(resolve => {
			new foundry.applications.api.DialogV2({
				window: { title: "Critical Failure — False Information?", classes: ["rk-crit-fail-dialog"] },
				content: `
					<style>.rk-crit-fail-dialog .form-footer { flex-direction: row; }</style>
					<p>
						<strong>${characterName}</strong> critically failed their Recall Knowledge check.
						Per RAW, you may feed them false information that seems plausible.
					</p>
				`,
				buttons: [
					{ action: "deceive", label: "Feed False Information", default: true },
					{ action: "blank",   label: "Send Blank Message"                   },
					{ action: "dismiss", label: "Dismiss"                              },
				],
				submit:      result => resolve(result),
				rejectClose: false,
			}).render({ force: true });
		});

		if (!deceiveChoice || deceiveChoice === "dismiss") return;

		if (deceiveChoice === "blank") {
			ChatMessage.create({
				content: `<em>${characterName}'s mind draws a blank, they cannot remember anything about this creature...</em>`,
				whisper: [rollingUser.id],
			});
			return;
		}

		// Let the player pick a category — they'll receive false info
		game.socket.emit(MODULE_SOCKET, {
			command:      "rkPromptPlayer",
			targetUserId: rollingUser.id,
			creatureUuid: creatureActor.uuid,
			creatureName: creatureActor.name,
			picks:        1,
			deceptive:    true,
		});
		return;
	}

	game.socket.emit(MODULE_SOCKET, {
		command:      "rkPromptPlayer",
		targetUserId: rollingUser.id,
		creatureUuid: creatureActor.uuid,
		creatureName: creatureActor.name,
		picks:        outcome === "critSuccess" ? 2 : 1,
	});
}


// ─── Player: info selection dialog ───────────────────────────────────────────

async function _rkPlayerInfoDialog({ creatureUuid, creatureName, picks, deceptive = false }) {
	const makeSelect = name => `
		<select name="${name}" style="width:100%;margin-top:0.25em;">
			${INFO_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join("")}
		</select>
	`;

	const content = picks === 2
		? `<form>
				<p>Your thorough knowledge reveals <strong>two</strong> pieces of information about <strong>${creatureName}</strong>:</p>
				<div class="form-group"><label>First choice:</label>${makeSelect("pick1")}</div>
				<div class="form-group" style="margin-top:0.5em;"><label>Second choice:</label>${makeSelect("pick2")}</div>
			</form>`
		: `<form>
				<p>You recall one piece of information about <strong>${creatureName}</strong>:</p>
				<div class="form-group">${makeSelect("pick1")}</div>
			</form>`;

	let selections;
	try {
		selections = await new Promise((resolve, reject) => {
			new foundry.applications.api.DialogV2({
				window: { title: `Recall Knowledge — ${creatureName}` },
				content,
				buttons: [
					{
						action:   "submit",
						label:    "Submit",
						default:  true,
						callback: (_e, btn) => {
							const result = [btn.form.elements.pick1.value];
							if (btn.form.elements.pick2) result.push(btn.form.elements.pick2.value);
							return result;
						},
					},
					{ action: "cancel", label: "Cancel" },
				],
				submit:      result => { if (result === "cancel") reject(new Error("canceled")); else resolve(result); },
				rejectClose: true,
			}).render({ force: true });
		});
	} catch { return; }

	for (const selection of selections) {
		if (selection === "question") {
			await _rkQuestionDialog({ creatureName });
		} else {
			game.socket.emit(MODULE_SOCKET, {
				command:      "rkRevealRequest",
				selection,
				creatureUuid,
				targetUserId: game.user.id,
				deceptive,
			});
		}
	}
}

// ─── Macro entry point ────────────────────────────────────────────────────────

async function recallKnowledgeMacro() {
	// No target: open question dialog
	const target = [...game.user.targets][0];
	if (!target) {
		await _rkQuestionDialog();
		return;
	}

	// Has target: delegate the roll to the xdy-pf2e-workbench Recall Knowledge
	// macro, which handles skill detection, DCs, and blind rolling.
	const pack = game.packs.get("xdy-pf2e-workbench.asymonous-benefactor-macros-internal");
	if (!pack) {
		ui.notifications.warn("PF2e Workbench not found. Use the Workbench Recall Knowledge macro directly.");
		return;
	}
	const macroDoc = (await pack.getDocuments({ name: "XDY DO_NOT_IMPORT Recall_Knowledge" }))?.[0];
	if (!macroDoc) {
		ui.notifications.warn("Workbench Recall Knowledge macro not found.");
		return;
	}
	// Ensure execute permission then run it
	const execMacro = macroDoc.canExecute
		? macroDoc
		: new macroDoc.constructor(
			foundry.utils.mergeObject(
				macroDoc.toObject(),
				{ "-=_id": null, "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
				{ performDeletions: true, inplace: true }
			)
		);
	execMacro.execute();
}

// ─── Hook: detect blind RK rolls in chat ─────────────────────────────────────

Hooks.on("createChatMessage", async (msg) => {
	if (!game.user.isGM) return;

	const rollingUserId = msg.author?.id ?? msg.userId;
	let creatureUuid    = null;

	// Path 1: PF2e system / workbench — flags.pf2e.context present
	const ctx = msg.flags?.pf2e?.context;
	if (ctx?.options?.includes("action:recall-knowledge") && ctx.rollMode === "blindroll") {
		creatureUuid = ctx.target?.actor ?? _rkPending[rollingUserId]?.creatureUuid;
		delete _rkPending[rollingUserId];
	}

	// Path 2: PF2e HUD — detected via flavor HTML
	if (!creatureUuid && msg.flavor?.includes("pf2e-hud-rk")) {
		// Some HUD/toolbelt versions stamp the UUID in pf2e-thaum-vuln flags
		creatureUuid = msg.flags?.["pf2e-thaum-vuln"]?.targets?.[0]?.actorUuid;

		// Fallback: extract creature name from flavor and look up the token/actor
		if (!creatureUuid) {
			const nameMatch = msg.flavor.match(/data-whose="target"[^>]*>Target:\s*([^<]+?)\s*<\/span>/);
			if (nameMatch) {
				const creatureName = nameMatch[1].trim();
				const token = canvas.tokens.placeables.find(t => t.actor?.name === creatureName);
				creatureUuid = token?.actor?.uuid ?? game.actors.getName(creatureName)?.uuid;
			}
		}
	}

	// Path 3: Basic Action Macro (BAM) — creature name and roll data in content
	if (!creatureUuid && msg.content?.includes("<strong>Recall Knowledge</strong>")) {
		const nameMatch = msg.content.match(/<strong>vs\.\s+([^<]+)<\/strong>/);
		if (nameMatch) {
			const creatureName = nameMatch[1].trim();
			const token = canvas.tokens.placeables.find(t => t.actor?.name === creatureName);
			creatureUuid = token?.actor?.uuid ?? game.actors.getName(creatureName)?.uuid;
		}
	}

	if (!creatureUuid) return;

	const rollingUser = game.users.get(rollingUserId);
	const characterName = msg.speaker?.alias ?? rollingUser?.name ?? "Unknown";
	const rollTotal     = _rkExtractRollTotal(msg);
	const skillName     = _rkExtractSkillName(msg);

	// Collect this result; wait 600ms for any additional skill messages to arrive,
	// then show one GM dialog with all results.
	if (!_rkCollecting[rollingUserId]) {
		_rkCollecting[rollingUserId] = { entries: [], creatureUuid, rollingUser, characterName, firstMsg: msg };
	}
	_rkCollecting[rollingUserId].entries.push({ skillName, rollTotal });

	clearTimeout(_rkCollecting[rollingUserId].timer);
	_rkCollecting[rollingUserId].timer = setTimeout(async () => {
		const collected = _rkCollecting[rollingUserId];
		delete _rkCollecting[rollingUserId];
		const creatureActor = await fromUuid(collected.creatureUuid);
		if (!creatureActor) return;
		await _rkGMOutcomeDialog(collected, creatureActor);
	}, 600);
});

// ─── Ready: socket listeners + API export ────────────────────────────────────

Hooks.once("ready", () => {
	game.socket.on(MODULE_SOCKET, async (data) => {
		switch (data.command) {

			case "rkQuestion":
				if (!game.user.isGM) return;
				await _rkGMReplyDialog(data);
				break;

			case "rkPromptPlayer":
				if (data.targetUserId !== game.user.id) return;
				await _rkPlayerInfoDialog(data);
				break;

			case "rkRevealRequest": {
				if (!game.user.isGM) return;
				const actor      = await fromUuid(data.creatureUuid);
				if (!actor) return;
				const info       = data.deceptive
					? _rkFormatFalseInfo(actor, data.selection)
					: _rkFormatInfo(actor, data.selection);
				const targetUser = game.users.get(data.targetUserId);
				if (info && targetUser) ChatMessage.create({ content: info, whisper: [targetUser.id] });
				break;
			}
		}
	});

	const mod = game.modules.get(MODULE_ID);
	Object.assign(mod.api ??= {}, { recallKnowledgeMacro });
});
