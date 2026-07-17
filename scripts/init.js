console.log("%cJoe's PF2e Stuff | init.js loaded","color: yellow; font-weight: bold;");
//	Function to display image for user for a set time
function showImageDialog(imageUrl, duration = 5000, imgTitle = "Handout") {
	const dialogId = "visual-aid-dialog";
	const dialog = new Dialog({
		title: imgTitle,
		content: `
			<div style="display: flex; justify-content: center; align-items: center; height: 100%;">
				<img src="${imageUrl}" style="max-width: 100%; max-height: 60vh; height: auto;" />
			</div>
		`,
		buttons: {},
		render: (html) => {
			const img = html[0].querySelector("img");
			if (img) {
				img.onload = () => {
					dialog.setPosition({ height: "auto" });
					setTimeout(() => {
						dialog.setPosition({
							left: (window.innerWidth - dialog.position.width) / 2,
							top: (window.innerHeight - dialog.position.height) / 2
						});
					}, 50);
				};
			}
		}
	}, {
		id: dialogId,
		width: "auto",
		height: "auto",
		resizable: true
	});

	dialog.render(true);

	setTimeout(() => {
		if (dialog.rendered) dialog.close();
	}, duration);
}

//	Macro Function to display dialog to send an image to selected players
function sendImageDialog(){
	const MODULE_SOCKET = "module.joes-pf2e-stuff";
	const connectedUsers = game.users.filter(u => u.active && u.id !== game.user.id);
	const defaultImage = "https://i.imgflip.com/9v19i0.jpg";

	if (connectedUsers.length === 0) {
		ui.notifications.warn("No other users are currently logged in.");
		return;
	}

	new Dialog({
		title: "Show Centered Image",
		content: `
			<div class="form-group">
				<label>Choose Image:</label>
				<div class="form-fields">
					<input type="text" id="image-path" name="image-path" value="${defaultImage}" style="width: 100%">
					<button type="button" id="browse-image"><i class="fas fa-file-import"></i></button>
				</div>
			</div>
			<div class="form-group">
				<label>Duration:</label>
				<div class="form-fields">
					<select id="duration">
						<option value="5000" selected>5 seconds</option>
						<option value="10000">10 seconds</option>
						<option value="15000">15 seconds</option>
					</select>
				</div>
			</div>
			<hr>
			<label>Send To:</label>
			<div style="max-height: 200px; overflow-y: auto; margin-bottom: 10px;">
				${connectedUsers.map(u => `
					<label style="display: block;">
						<input type="checkbox" class="user-checkbox" value="${u.id}" checked> ${u.name}
					</label>
				`).join("")}
			</div>
			<div class="form-group">
				<label>Window Title:</label>
				<div class="form-fields">
					<input type="text" id="img-title" name="img-title" value="Handout" />
				</div>
			</div>
			<br />
		`,
		buttons: {
			send: {
				label: "Send",
				callback: html => {
					const imagePath = html.find("#image-path").val();
					const duration = parseInt(html.find("#duration").val(), 10);
					const selectedUsers = Array.from(html.find(".user-checkbox:checked")).map(el => el.value);
					const title = html.find("#img-title").val()?.trim() || "handout";


					if (!imagePath || selectedUsers.length === 0) {
						ui.notifications.warn("Select an image, users, and duration.");
						return;
					}

					game.socket.emit(MODULE_SOCKET, {
						command: "showImage",
						imageUrl: imagePath,
						users: selectedUsers,
						duration,
						imgTitle: title
					});

					//if (selectedUsers.includes(game.user.id)) {
						game.modules.get("joes-pf2e-stuff").api.showImageDialog(imagePath, duration);
					//}

					ui.notifications.info("Image sent.");
				}
			},
			cancel: { label: "Cancel" }
		},
		default: "send",
		render: (html, dialog) => {
			html.find("#browse-image").click(() => {
				const input = html.find("#image-path");
				new FilePicker({
					type: "image",
					current: input.val(),
					callback: path => input.val(path)
				}).browse();
			});
		}
	}).render(true);
}

//	Function to check setting and return it
//	will ONLY work for settings for this module!
export function getSetting(settingName, returnIfError = false) {
    // Validate the setting name
    if (typeof settingName !== "string" || settingName.trim() === "") {
        debugLog(3, `Invalid setting name provided: ${settingName}`);
        return returnIfError; // Return undefined or a default value
    }

    // Check if the setting is registered
    if (!game.settings.settings.has(`joes-pf2e-stuff.${settingName}`)) {
        debugLog(3, `Setting "${settingName}" is not registered.`);
        return returnIfError; // Return undefined or a default value
    }

    try {
        // Attempt to retrieve the setting value
        const value = game.settings.get("joes-pf2e-stuff", settingName);
        //debugLog(1, `Successfully retrieved setting "${settingName}":`, value);
        return value;
    } catch (error) {
        // Log the error and return undefined or a default value
        debugLog(3, `Failed to get setting "${settingName}":`, error);
        return returnIfError;
    }
}

//	Function for debugging
export function debugLog(intLogType, stringLogMsg, objObject = null) {
	
	// Get Timestamps
	const now = new Date();
	const timestamp = now.toTimeString().split(' ')[0]; // "HH:MM:SS"
	
	// Handle the case where the first argument is a string
	if (typeof intLogType === "string") {
		objObject = stringLogMsg; // Shift arguments
		stringLogMsg = intLogType;
		intLogType = 1; // Default log type to 'all'
	}
	const debugLevel = game.settings.get("joes-pf2e-stuff", "debugLevel");

	// Map debugLevel setting to numeric value for comparison
	const levelMap = {
		"none": 4,
		"error": 3,
		"warn": 2,
		"all": 1
	};

	const currentLevel = levelMap[debugLevel] || 4; // Default to 'none' if debugLevel is undefined

	// Check if the log type should be logged based on the current debug level
	if (intLogType < currentLevel) return;

	// Capture stack trace to get file and line number
	const stack = new Error().stack.split("\n");
	let fileInfo = "Unknown Source";
	for (let i = 2; i < stack.length; i++) {
		const line = stack[i].trim();
		const fileInfoMatch = line.match(/(\/[^)]+):(\d+):(\d+)/); // Match file path and line number
		if (fileInfoMatch) {
			const [, filePath, lineNumber] = fileInfoMatch;
			const fileName = filePath.split("/").pop(); // Extract just the file name
			// Ensure the file is one of the allowed files
			/*
			const allowedFiles = ["init.js", "error-logger.js", "tokenZeroHP.js"];
			if (allowedFiles.includes(fileName)) {
				fileInfo = `${fileName}:${lineNumber}`;
				break;
			}
			*/
			
		}
	}

	// Prepend the file and line info to the log message
	const formattedLogMsg = `[${fileInfo}] ${stringLogMsg}`;
	
	if (objObject) {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%cJoe's PF2e Stuff [${timestamp}] | ${formattedLogMsg}`, "color: yellow; font-weight: bold;", objObject);
				break;
			case 2: // Warning
				console.log(`%cJoe's PF2e Stuff [${timestamp}] | WARNING: ${formattedLogMsg}`, "color: orange; font-weight: bold;", objObject);
				break;
			case 3: // Critical/Error
				console.log(`%cJoe's PF2e Stuff [${timestamp}] | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;", objObject);
				break;
			default:
				console.log(`%cJoe's PF2e Stuff [${timestamp}] | ${formattedLogMsg}`, "color: yellow; font-weight: bold;", objObject);
		}
	} else {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%cJoe's PF2e Stuff [${timestamp}] | ${formattedLogMsg}`, "color: yellow; font-weight: bold;");
				break;
			case 2: // Warning
				console.log(`%cJoe's PF2e Stuff [${timestamp}] | WARNING: ${formattedLogMsg}`, "color: orange; font-weight: bold;");
				break;
			case 3: // Critical/Error
				console.log(`%cJoe's PF2e Stuff [${timestamp}] | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;");
				break;
			default:
				console.log(`%cJoe's PF2e Stuff [${timestamp}] | ${formattedLogMsg}`, "color: yellow; font-weight: bold;");
		}
	}
}

const KINGMAKER_HEX_BUTTON_SELECTOR = 'button[data-tool="hex"]';

// Reads the hex tool's real on/off state from the DOM (aria-pressed), since the internal
// tool object's "active" property doesn't reliably track clicks made via onChange() calls.
function isKingmakerHexButtonActive(hexButton) {
	return hexButton.getAttribute("aria-pressed") === "true";
}

// Macro function: clicks the real hex toolbar button so Kingmaker's full click-handling
// path runs (calling onChange() directly skips context HexHUD needs to render correctly).
function toggleKingmakerHexTools() {
	if (!game.modules.get("pf2e-kingmaker")?.active) {
		debugLog(2, "toggleKingmakerHexTools: pf2e-kingmaker is not active.");
		return;
	}

	const hexButton = document.querySelector(KINGMAKER_HEX_BUTTON_SELECTOR);
	if (!hexButton) {
		debugLog(2, "toggleKingmakerHexTools: hex tool button not found - must be on the Kingmaker hex map scene.");
		return;
	}

	hexButton.click();
}

// Restore Kingmaker hex tool state from user flags. Called after canvasReady.
// Clicks the real button only when its current state doesn't already match the saved one.
function restoreKingmakerHexTools() {
	if (!game.modules.get("pf2e-kingmaker")?.active) return;

	const state = game.user.getFlag("joes-pf2e-stuff", "hexToolState");
	if (!state) return;

	debugLog(1, "restoreKingmakerHexTools: restoring state", state);

	const hexButton = document.querySelector(KINGMAKER_HEX_BUTTON_SELECTOR);
	if (hexButton) {
		if (isKingmakerHexButtonActive(hexButton) !== state.hex) hexButton.click();
	} else {
		debugLog(2, "restoreKingmakerHexTools: hex tool button not found in DOM.");
	}

	if (game.modules.get("pf2e-kingmaker-helper")?.active && game.coloredAndIconsLayer) {
		game.coloredAndIconsLayer.visible = state.colored ?? state.hex;
		game.coloredAndIconsLayer.draw();
	}
}

// Delegated click listener on the real hex toolbar button: saves state for whichever user
// clicked it (native click or our own macro's synthetic click), GM or player alike.
document.addEventListener("click", (event) => {
	const hexButton = event.target.closest?.(KINGMAKER_HEX_BUTTON_SELECTOR);
	if (!hexButton) return;
	if (!game.modules.get("pf2e-kingmaker")?.active) return;

	// Defer so aria-pressed has updated to reflect the click before we read it.
	setTimeout(() => {
		const hexActive = isKingmakerHexButtonActive(hexButton);
		const coloredActive = (game.modules.get("pf2e-kingmaker-helper")?.active && game.coloredAndIconsLayer)
			? game.coloredAndIconsLayer.visible
			: false;

		game.user.setFlag("joes-pf2e-stuff", "hexToolState", { hex: hexActive, colored: coloredActive });
		debugLog(1, `hex button clicked: saved hex=${hexActive}, colored=${coloredActive}`);
	}, 0);
});

// Macro function to award hero points to all party members, with a dialog to choose amount and mode (add/set)
export async function heroPointMacro() {

	const heroPointImages = [
		"assets/memes/9v19i0.webp",
		"assets/memes/hp-2.webp",
		"assets/memes/2.webp",
		"assets/memes/3.webp",
		"assets/memes/4.webp"
	];

	if (!game.user.isGM) {
		ui.notifications.warn("Only the GM can award Hero Points.");
		return;
	}

	// -------------------------------------------------------------------------
	// DialogV2 (custom), returns { amount, mode } or throws on cancel/close
	// -------------------------------------------------------------------------
	let formData;
	try {
		formData = await new Promise((resolve, reject) => {

			const dlg = new foundry.applications.api.DialogV2({
				window: { title: "Award Hero Points" },
				content: `
					<form>
						<div style="display: flex; align-items: center; gap: 1em;">
							<input id="hero-amount" name="hero-amount" type="number" min="0" max="3" step="1" value="1" style="width: 60px;" />
							<label><input type="radio" name="mode" value="add" checked> Add</label>
							<label><input type="radio" name="mode" value="set"> Set</label>
						</div>
					</form>
				`,
				buttons: [{
					action: "apply",
					label: "Apply",
					default: true,
					callback: (event, button, dialog) => {
						const val = button.form.elements["hero-amount"].valueAsNumber;
						const mode = button.form.elements["mode"].value;

						if (Number.isNaN(val) || val < 0 || val > 3) {
							ui.notifications.warn("Enter a number between 0 and 3.");
							return null;
						}

						return { amount: val, mode };
					}
				}, {
					action: "cancel",
					label: "Cancel"
				}],
				submit: (result) => {
					if (!result) return; // invalid input already warned
					if (result === "cancel") return reject(new Error("canceled"));
					resolve(result);
				},
				rejectClose: true,
				modal: true
			});

			dlg.render({ force: true });

			// If rejectClose triggers, DialogV2 will reject the internal promise path.
			// We catch it here by listening for close via the rejection path above.
			// (If Foundry changes this behavior, worst case: closing just does nothing.)
		});
	} catch {
		// canceled/closed
		return;
	}

	const { amount, mode } = formData;

	const awarded = [];
	const updatedActorIds = new Set();
	const partyActors = game.actors.party?.members ?? [];

	if (partyActors.length === 0) {
		ui.notifications.warn("No party members found in the Party group.");
		return;
	}

	// Toolbelt heroActions API (new location)
	const toolbeltActive = !!game.modules.get("pf2e-toolbelt")?.active;
	const heroActionsApi = toolbeltActive ? game.toolbelt?.api?.heroActions : null;

	const drawPromises = [];

	for (const actor of partyActors) {
		if (!actor || updatedActorIds.has(actor.id)) continue;

		const heroPoints = actor.system?.resources?.heroPoints;
		if (!heroPoints) continue;

		const current = heroPoints.value ?? 0;
		const max = heroPoints.max ?? 3;
		const newTotal = mode === "set"
			? Math.min(amount, max)
			: Math.min(current + amount, max);

		await actor.update({ "system.resources.heroPoints.value": newTotal });
		awarded.push(`<strong>${actor.name}</strong>: ${current} → ${newTotal}`);
		updatedActorIds.add(actor.id);

		// Draw hero actions (Toolbelt)
		if (heroActionsApi?.drawHeroActions) {
			drawPromises.push(heroActionsApi.drawHeroActions(actor));
		}
	}

	await Promise.all(drawPromises);

	if (awarded.length === 0) {
		ui.notifications.info("No eligible actors on selected tokens.");
		return;
	}

	if (mode === "add") {
		const imagePath = heroPointImages[Math.floor(Math.random() * heroPointImages.length)];
		const duration = 7000;
		const title = "Hero Points!!";

		// Send to all active users
		const userIds = game.users.filter(u => u.active).map(u => u.id);
		debugLog("🛰 Sending image socket", { imagePath, userIds, duration, title });

		game.socket.emit("module.joes-pf2e-stuff", {
			command: "showImage",
			imageUrl: imagePath,
			users: userIds,
			duration,
			imgTitle: title
		});

		// Local show (GM client)
		if (userIds.includes(game.user.id)) {
			showImageDialog(imagePath, duration, title);
		}
	}

	const flavorText = `
		<div style="
			background-color:#1d1c1a;
			border: 2px solid #5f574e;
			box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.6);
			border-radius: 12px;
			padding: 16px;
			color: #e4ddc7;
			font-family: 'serif';
			max-width: 500px;
			margin: auto;
		">
			<div style="display: flex; justify-content: center; margin-bottom: 10px;">
				<img src="systems/pf2e/icons/features/feats/heroic-recovery.webp" width="64" height="64" style="border: none;">
			</div>
			<div style="text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 1px; color: #c7b26f; margin-bottom: 12px;">
				HEROIC INSPIRATION
			</div>
			<div style="font-size: 14px; font-style: italic; margin-bottom: 12px; text-align: center;">
				Fortune favors the bold.<br>The tale shifts, a second chance emerges...
			</div>
			<hr style="border: 1px solid #5f574e;">
			<div style="font-size: 15px; text-align: center; margin: 12px 0;">
				${mode === "set" ? `Set Hero Points to <strong>${amount}</strong> for each:` : `Awarded <strong>${amount}</strong> Hero Point${amount > 1 ? "s" : ""} to each:`}
			</div>
			<div style="text-align: center; font-size: 14px; margin-bottom: 10px;">
				${awarded.join("<br>")}
			</div>
			<hr style="border: 1px solid #5f574e;">
			<div style="font-size: 12px; font-style: italic; text-align: center; color: #a09888; margin-top: 6px;">
				Their destinies are not yet sealed.
			</div>
		</div>
	`;

	setTimeout(() => {
		ChatMessage.create({ content: flavorText });
	}, 2000);

}

Hooks.once("init", () => {

/*
	Send Image on hero point
*/
	game.settings.register("joes-pf2e-stuff", "sendHeroPointImg", {
		scope: "world",
		type: Boolean,
		default: true,
		config: true,
		name: "Send Image when adding Hero Points",
		hint: ""
	});
	
	game.settings.register("joes-pf2e-stuff", "heroPointImage", {
		name: "Hero Point Image Path",
		hint: "Path to the image shown when Hero Points are reset or added.",
		scope: "world",
		config: true,
		default: "assets/memes/9v19i0.jpg",
		type: String
	});


/*
	Error Logs
*/
	game.settings.register("joes-pf2e-stuff", "enableErrorLogs", {
		scope: "world",
		type: Boolean,
		default: true,
		config: true,
		name: "Enable Error Logger",
		hint: "Capture player errors in Journal entry named 'Error Logs'"
	});
	
/*
	Setting for 0hp NPC
*/
	game.settings.register("joes-pf2e-stuff", "deadTokenAction", {
		scope: "world",
		type: String,
		choices: {
			hide: "Hide Token",
			blood: "Blood Splash*",
			disabled: "Disabled"
		},
		default: "hide",
		config: true,
		name: "NPC at 0 hp",
		hint: "How to handle npc token at 0hp. *Requires Token Magic FX"
	});
	
/*
	Debugging
*/
	// Register debugLevel setting
	game.settings.register("joes-pf2e-stuff", "debugLevel", {
		name: "Debug Level",
		hint: "Set Level of debuging in console",
		scope: "world",
		config: true,
		type: String,
		choices: {
			"none": "None",
			"error": "Errors",
			"warn": "Warning + Errors",
			"all": "All"
		},
		default: "none", // Default to no logging
		requiresReload: false
	});

	// Log debug status
	const debugLevel = game.settings.get("joes-pf2e-stuff", "debugLevel");
	console.log(`%cJoe's PF2e Stuff | Debugging Level: ${debugLevel}`,"color: yellow; font-weight: bold;");	
});

Hooks.once("ready", () => {
	const mod = game.modules.get("joes-pf2e-stuff");
	Object.assign(mod.api ??= {}, {
		showImageDialog,
		sendImageDialog,
		heroPointMacro,
		toggleKingmakerHexTools,
		restoreKingmakerHexTools
	});
	
	debugLog("Socket listener ready");

	game.socket.on("module.joes-pf2e-stuff", (data) => {
		if (data.command !== "showImage") return;
		if (!data.users.includes(game.user.id)) return;

		const imageUrl = data.imageUrl;
		const duration = data.duration ?? 5000;
		const imgTitle = data.imgTitle ?? "Handout";
		
		debugLog(`Showing image: ${imageUrl} with title ${imgTitle} for ${duration}ms`);
		showImageDialog(imageUrl, duration, imgTitle);
	});
});

Hooks.on("canvasReady", () => {
	setTimeout(() => restoreKingmakerHexTools(), 1000);
});

Hooks.on("createChatMessage", (msg) => {
	if (!game.user.isGM || !game.settings.get("joes-pf2e-stuff", "sendHeroPointImg")) return;

	const content = msg.content?.toLowerCase();
	if (!content) return;

	const match = [
		"hero points reset",
		"hero point(s) added"
	].some(pattern => content.includes(pattern));

	if (match) {
		debugLog("Hero Point trigger matched");

		const imageUrl = game.settings.get("joes-pf2e-stuff", "heroPointImage");
		const duration = 7000;
		const title = "Hero Points!!";

		// Send to all active players
		for (const user of game.users) {
			if (!user.active) continue;

			if (user.id === game.user.id) {
				showImageDialog(imageUrl, duration, title);
			} else {
				game.socket.emit("module.joes-pf2e-stuff", {
					command: "showImage",
					imageUrl,
					users: [user.id],
					duration,
					imgTitle: title
				});
			}
		}
	}
});
