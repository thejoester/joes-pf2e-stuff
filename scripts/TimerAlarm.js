const moduleName = "joes-pf2e-stuff";
const settingKey = "activeTimers";

// Simple ID generator using crypto or fallback
function generateTimerId() {
	return `timer-${crypto.randomUUID?.() || Math.floor(Math.random() * 1e9)}`;
}

Hooks.once("init", () => {
	game.settings.register(moduleName, settingKey, {
		name: "Active Timers",
		scope: "world",
		config: false,
		type: Object,
		default: {}
	});
});

Hooks.once("ready", () => {
	Object.assign(game.modules.get("joes-pf2e-stuff").api ??= {}, {
		startTimer,
		timerMacro,
		getRemainingTime
	});
	
	const timers = game.settings.get(moduleName, settingKey) || {};
	const now = Date.now();

	for (const [id, timer] of Object.entries(timers)) {
		if (timer.endTime > now) {
			setTimeout(() => onTimerEnd(id), timer.endTime - now);
		}
	}
});


export async function startTimer(title, minutes) {
	
	const id = generateTimerId();
	const now = Date.now();
	const endTime = now + minutes * 60_000;
	const timerData = {
		id,
		title,
		endTime,
		createdAt: now,
		minutes,
		createdBy: game.user.id
	};	
	const timers = game.settings.get(moduleName, settingKey) || {};
	timers[id] = timerData;
	await game.settings.set(moduleName, settingKey, timers);

	ui.notifications.info(`⏱ Timer set for ${minutes}m: "${title}"`);

	setTimeout(() => onTimerEnd(id), minutes * 60_000);
}

async function onTimerEnd(id) {
	const timers = game.settings.get(moduleName, settingKey) || {};
	const timer = timers[id];
	if (!timer || timer.endTime > Date.now()) return;

	// ✅ Only show dialog if this user created it
	if (timer.createdBy !== game.user.id) return;

	AudioHelper.play({
		src: "modules/joes-pf2e-stuff/assets/sound/bonus.mp3",
		volume: 0.8,
		autoplay: true,
		loop: false
	});

	new foundry.applications.api.DialogV2({
		window: { title: "Timer Ended" },
		content: `<p>⏳ <strong>${timer.title}</strong></p><p>The timer is complete.</p>`,
		buttons: [
			{
				action: "restart",
				label: "Restart Timer",
				default: true,
				callback: async () => {
					await startTimer(timer.title, timer.minutes);
				}
			},
			{
				action: "stop",
				label: "Stop Timer",
				callback: async () => {
					delete timers[id];
					await game.settings.set(moduleName, settingKey, timers);
				}
			}
		]
	}).render(true);
}


export async function timerMacro() {
	const timers = game.settings.get(moduleName, settingKey) || {};
	const now = Date.now();

	const timerList = Object.values(timers).length
		? Object.values(timers)
			.map(t => {
				const remaining = t.endTime - now;
				if (remaining <= 0) return "";
				const mins = Math.floor(remaining / 60000);
				const secs = Math.floor((remaining % 60000) / 1000);
				return `
					<div style="display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.5em; margin-bottom: 6px; padding: 6px 8px; border-radius: 6px; background: rgba(255,255,255,0.03);">
						<div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
							<strong>${t.title}</strong> – ${mins}m ${secs}s remaining
						</div>
						<button type="button" data-id="${t.id}" title="Cancel Timer"
							style="background: none; border: none; color: #ff5555; font-size: 1.1em; cursor: pointer;">
							<i class="fas fa-trash"></i>
						</button>
					</div>`;
			})
			.join("")
		: "<p>No active timers.</p>";

	const dialog = new foundry.applications.api.DialogV2({
		window: { title: "Manage Timers" },
		content: `
			<form>
				<div style="margin-bottom: 1em;">
					${timerList}
				</div>
				<hr style="opacity: 0.2; margin: 10px 0;">
				<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75em; align-items: end; margin-top: 8px;">
					<div style="display: flex; flex-direction: column;">
						<label for="title" style="font-size: 0.85em; margin-bottom: 2px;">Title</label>
						<input type="text" name="title" id="title" placeholder="Timer name"
							style="padding: 4px; border-radius: 4px; max-width: 220px;" value="Hero Points Timer">
					</div>
					<div style="display: flex; flex-direction: column;">
						<label for="minutes" style="font-size: 0.85em; margin-bottom: 2px;">Minutes</label>
						<input type="number" name="minutes" id="minutes" placeholder="Minutes" min="1"
							style="padding: 4px; border-radius: 4px; max-width: 100px;" value="60">
					</div>
				</div>
			</form>
		`,
		buttons: [
			{
				action: "add",
				label: "Add Timer",
				default: true,
				callback: async (event, button, dialog) => {
					const form = button.form;
					const title = form.title.value.trim();
					const minutes = parseInt(form.minutes.value, 10);
					if (!title || isNaN(minutes) || minutes < 1) {
						ui.notifications.warn("Please enter valid title and minutes.");
						return;
					}
					await startTimer(title, minutes);
				}
			}
		]
	});

	// Use hook to bind button events after actual DOM is rendered
	Hooks.once("renderDialogV2", (app, html) => {
		html.querySelectorAll("button[data-id]").forEach(btn => {
			btn.addEventListener("click", async () => {
				const id = btn.dataset.id;
				const timers = game.settings.get(moduleName, settingKey) || {};
				delete timers[id];
				await game.settings.set(moduleName, settingKey, timers);
				ui.notifications.info("⛔ Timer cancelled.");
				app.close();
				timerMacro(); // Re-render dialog with updated list
			});
		});
	});

	dialog.render(true);
}

export function getRemainingTime() {
	const timers = game.settings.get(moduleName, settingKey) || {};
	const now = Date.now();

	return Object.values(timers)
		.map(timer => {
			const remaining = timer.endTime - now;
			return {
				id: timer.id,
				title: timer.title,
				remaining,
				minutes: timer.minutes
			};
		})
		.filter(t => t.remaining > 0);
}

