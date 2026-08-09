console.log("%cJoe's PF2e Stuff | nimble-dodge.js loaded", "color: yellow; font-weight: bold;");

import { debugLog, getSetting } from "./init.js";

const MOD_ID = "joes-pf2e-stuff";
const SOCKET = "module.joes-pf2e-stuff";
const FEAT_SLUG = "nimble-dodge";
const ROLL_DOMAIN = "all";			// domain of the feat's built-in RollOption toggle
const ROLL_OPTION = "nimble-dodge";	// option name of that toggle
const FLAG_USED = "nimbleDodgeUsed";	// actor flag: reaction spent this round

// Pending prompt replies on the attacker's client, keyed by requestId
const pending = new Map();

// Open prompt dialogs on the responder's client, keyed by requestId (so the GM can close them)
const openPrompts = new Map();

// Settle a pending prompt reply (from socket reply or GM cancel)
function resolvePending(requestId, value) {
	const entry = pending.get(requestId);
	if (!entry) return false;
	pending.delete(requestId);
	entry.resolve(value);
	return true;
}

// Minimal HTML escape for names injected into dialog content
function esc(str) {
	return String(str ?? "").replace(/[&<>"']/g, (c) => (
		{ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
	));
}

// True when this attack roll should trigger a Nimble Dodge prompt.
// Logs the bail reason for attack rolls so the decision path is visible at debug level "all".
function shouldPrompt(context) {
	if (context?.type !== "attack-roll") return false;	// weapon Strikes and spell attacks both use this type
	const actor = context?.target?.actor;
	debugLog(1, `shouldPrompt(): attack-roll seen, target=${actor?.name ?? "none"}`);

	if (!getSetting("nimbleDodgeEnabled", true)) { debugLog(1, "shouldPrompt(): feature disabled by setting"); return false; }
	if (!actor) { debugLog(1, "shouldPrompt(): no target actor"); return false; }
	if (!actor.itemTypes?.feat?.some((f) => f.slug === FEAT_SLUG)) { debugLog(1, `shouldPrompt(): ${actor.name} has no ${FEAT_SLUG} feat`); return false; }
	if (!actor.inCombat) { debugLog(1, `shouldPrompt(): ${actor.name} not in combat`); return false; }
	// Nimble Dodge requires not being encumbered. bulk.isEncumbered is the source of truth
	// (the encumbered condition is only auto-created when the world's automatic-encumbrance setting is on).
	if (actor.inventory?.bulk?.isEncumbered || actor.hasCondition?.("encumbered")) { debugLog(1, `shouldPrompt(): ${actor.name} is encumbered, skipping`); return false; }
	if (actor.getFlag?.(MOD_ID, FLAG_USED)) { debugLog(1, `shouldPrompt(): ${actor.name} already used the reaction this round`); return false; }

	debugLog(1, `shouldPrompt(): ${actor.name} eligible for Nimble Dodge prompt`);
	return true;
}

// Pick who gets asked: an active non-GM owner of the target, else the active GM.
// When the GM-only setting is on, skip the owner and always ask the active GM.
function resolveResponder(actor) {
	if (!getSetting("nimbleDodgeGmOnly", false)) {
		const owner = game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
		if (owner) return owner;
	}
	return game.users.find((u) => u.active && u.isGM) ?? null;
}

// Yes/No dialog shown to whoever owns the target. Built manually (not DialogV2.wait) so we
// keep the instance in openPrompts and can close it remotely when the GM cancels.
function showPrompt(actor, attackerName, requestId = null) {
	return new Promise((resolve) => {
		const dialog = new foundry.applications.api.DialogV2({
			window: { title: "Nimble Dodge" },
			content: `
				<p><strong>${esc(actor.name)}</strong> is being attacked by <strong>${esc(attackerName)}</strong>.</p>
				<p>Use <strong>Nimble Dodge</strong> (reaction) for a +2 circumstance bonus to AC against this attack?</p>
			`,
			buttons: [
				{ action: "yes", label: "Use Reaction (+2 AC)", default: true, callback: () => resolve(true) },
				{ action: "no", label: "No", callback: () => resolve(false) }
			]
		});
		// Closing (X, Escape, or a remote cancel) counts as "no"
		dialog.addEventListener("close", () => {
			if (requestId) openPrompts.delete(requestId);
			resolve(false);
		}, { once: true });
		if (requestId) openPrompts.set(requestId, dialog);
		dialog.render({ force: true });
	});
}

// Spinner shown on the attacker's client while the remote owner decides. Cancel = no,
// and also tells the responder's client to close its open prompt.
function showWaitingDialog(targetName, requestId, responderId) {
	const dlg = new foundry.applications.api.DialogV2({
		window: { title: "Nimble Dodge" },
		content: `
			<div style="display:flex;align-items:center;gap:0.75em;padding:0.5em 0.25em;">
				<i class="fas fa-spinner fa-spin" style="font-size:1.5em;"></i>
				<span>Prompting <strong>${esc(targetName)}</strong>'s owner for Nimble Dodge&hellip;</span>
			</div>
		`,
		buttons: [{
			action: "cancel",
			label: "Cancel",
			callback: () => {
				game.socket.emit(SOCKET, { command: "nimbleDodgeCancel", targetUserId: responderId, requestId });
				resolvePending(requestId, { used: false });
			}
		}],
		rejectClose: false
	});
	dlg.render({ force: true });
	return dlg;
}

// The actor's Nimble Dodge feat item (owns the toggle rule)
function getNimbleFeat(actor) {
	return actor.itemTypes?.feat?.find((f) => f.slug === FEAT_SLUG) ?? null;
}

// Enable the feat's toggle + mark the reaction used, return the boosted AC value
async function useNimbleDodge(actor) {
	try {
		const feat = getNimbleFeat(actor);
		if (!feat) return null;
		await actor.toggleRollOption(ROLL_DOMAIN, ROLL_OPTION, feat.id, true);
		await actor.setFlag(MOD_ID, FLAG_USED, true);
		const ac = actor.armorClass?.value ?? null;
		debugLog(1, `useNimbleDodge(): ${actor.name} enabled toggle, boosted AC=${ac}`);
		return ac;
	} catch (err) {
		debugLog(3, "useNimbleDodge(): failed to enable toggle", err);
		return null;
	}
}

// Turn the transient toggle back off (the used flag persists until the target's turn)
async function revertNimbleDodge(actor) {
	try {
		if (!actor.rollOptions?.[ROLL_DOMAIN]?.[ROLL_OPTION]) return;
		const feat = getNimbleFeat(actor);
		if (!feat) return;
		await actor.toggleRollOption(ROLL_DOMAIN, ROLL_OPTION, feat.id, false);
		debugLog(1, `revertNimbleDodge(): ${actor.name} toggle disabled`);
	} catch (err) {
		debugLog(3, "revertNimbleDodge(): failed to disable toggle", err);
	}
}

// Ask the responder (locally or over socket) whether to use Nimble Dodge
function requestNimbleDodge(actor, context, responder) {
	const attackerName = context.token?.name ?? context.actor?.name ?? "A creature";
	debugLog(1, `requestNimbleDodge(): ${attackerName} vs ${actor.name}, asking ${responder.name}${responder.id === game.user.id ? " (local)" : " (remote)"}`);

	// Responder is us: prompt and apply directly, no socket needed
	if (responder.id === game.user.id) {
		return (async () => {
			const yes = await showPrompt(actor, attackerName);
			if (!yes) return { used: false };
			return { used: true, ac: await useNimbleDodge(actor) };
		})();
	}

	// Responder is remote: emit the prompt and await their reply (no timeout; GM can Cancel)
	const requestId = foundry.utils.randomID();
	const reply = new Promise((resolve) => {
		pending.set(requestId, { resolve });
	});

	game.socket.emit(SOCKET, {
		command: "nimbleDodgePrompt",
		requestId,
		targetUserId: responder.id,
		targetActorUuid: actor.uuid,
		attackerUserId: game.user.id,
		attackerName
	});

	// Show a spinner locally while we wait; close it however the reply settles
	const waiting = showWaitingDialog(actor.name, requestId, responder.id);
	return reply.finally(() => { try { waiting.close(); } catch { /* already closed */ } });
}

// Set the in-flight attack's target AC to the boosted value (fallback: +2)
function applyBoostedAc(context, ac) {
	if (!context?.dc) return;
	const oldVal = context.dc.value;
	const newVal = Number.isFinite(ac) ? ac : Number(context.dc.value) + 2;
	if (!Number.isFinite(newVal)) return;
	try {
		context.dc.value = newVal;
	} catch {
		context.dc = { ...context.dc, value: newVal };	// dc.value getter-only, replace object
	}
	debugLog(1, `applyBoostedAc(): target DC ${oldVal} -> ${context.dc.value}`);
}

// Tell the responder to revert the toggle once the attack has resolved
function revertOnResponder(actor, responder) {
	if (!responder) return;
	if (responder.id === game.user.id) {
		revertNimbleDodge(actor);
		return;
	}
	game.socket.emit(SOCKET, {
		command: "nimbleDodgeRevert",
		targetUserId: responder.id,
		targetActorUuid: actor.uuid
	});
}

// libWrapper around game.pf2e.Check.roll, runs on the attacker's client
async function onCheckRoll(wrapped, ...args) {
	const context = args[1];
	try {
		if (shouldPrompt(context)) {
			const actor = context.target.actor;
			const responder = resolveResponder(actor);
			if (responder) {
				const decision = await requestNimbleDodge(actor, context, responder);
				debugLog(1, `onCheckRoll(): decision for ${actor.name} = ${decision?.used ? "USE" : "no"}`);
				if (decision?.used) {
					applyBoostedAc(context, decision.ac);
					try {
						return await wrapped(...args);
					} finally {
						revertOnResponder(actor, responder);
					}
				}
			}
		}
	} catch (err) {
		debugLog(3, "onCheckRoll(): nimble dodge handling failed", err);
	}
	return wrapped(...args);
}

// Socket: prompt requests (responder side), replies (attacker side), reverts (responder side)
async function onSocket(data) {
	if (!data?.command) return;

	if (data.command === "nimbleDodgePrompt") {
		if (data.targetUserId !== game.user.id) return;
		debugLog(1, `onSocket(): prompt request for ${data.attackerName}'s attack, requestId=${data.requestId}`);
		let used = false, ac = null;
		const actor = await fromUuid(data.targetActorUuid);
		if (actor) {
			const yes = await showPrompt(actor, data.attackerName, data.requestId);
			if (yes) { ac = await useNimbleDodge(actor); used = true; }
		}
		game.socket.emit(SOCKET, {
			command: "nimbleDodgeReply",
			requestId: data.requestId,
			attackerUserId: data.attackerUserId,
			used,
			ac
		});
		return;
	}

	if (data.command === "nimbleDodgeReply") {
		if (data.attackerUserId !== game.user.id) return;
		debugLog(1, `onSocket(): reply received, used=${!!data.used}, ac=${data.ac}`);
		resolvePending(data.requestId, { used: !!data.used, ac: data.ac });
		return;
	}

	if (data.command === "nimbleDodgeCancel") {
		if (data.targetUserId !== game.user.id) return;
		const dlg = openPrompts.get(data.requestId);
		if (dlg) {
			openPrompts.delete(data.requestId);
			debugLog(1, `onSocket(): GM cancelled, closing prompt requestId=${data.requestId}`);
			dlg.close();
		}
		return;
	}

	if (data.command === "nimbleDodgeRevert") {
		if (data.targetUserId !== game.user.id) return;
		const actor = await fromUuid(data.targetActorUuid);
		if (actor) await revertNimbleDodge(actor);
	}
}

Hooks.once("ready", () => {
	// Register the wrapper regardless of the enabled setting; shouldPrompt() checks it live,
	// so toggling the setting takes effect immediately without a reload.
	if (!game.modules.get("lib-wrapper")?.active) {
		debugLog(3, "nimble-dodge: lib-wrapper is not active; feature disabled.");
		if (game.user.isGM) ui.notifications?.error("Joe's PF2e Stuff: the Nimble Dodge prompt requires the 'libWrapper' module.");
		return;
	}
	if (!game.pf2e?.Check?.roll) {
		debugLog(3, "nimble-dodge: game.pf2e.Check.roll unavailable; feature disabled.");
		return;
	}

	libWrapper.register(MOD_ID, "game.pf2e.Check.roll", onCheckRoll, "MIXED");
	game.socket.on(SOCKET, onSocket);
	debugLog(1, "nimble-dodge: wrapper and socket listener registered.");
});

// At the start of a combatant's turn, clear the used flag and force the toggle off
Hooks.on("pf2e.startTurn", async (combatant) => {
	if (game.user !== game.users.activeGM) return;
	const actor = combatant?.actor;
	if (!actor) return;
	if (actor.getFlag(MOD_ID, FLAG_USED)) {
		debugLog(1, `startTurn: clearing nimbleDodgeUsed flag for ${actor.name}`);
		await actor.unsetFlag(MOD_ID, FLAG_USED);
	}
	await revertNimbleDodge(actor);
});
