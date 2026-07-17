import { debugLog, getSetting } from './init.js';
console.log("%cJoe's PF2e Stuff | tokenZeroHP.js loaded","color: yellow; font-weight: bold;");
Hooks.once("ready", async () => {
	
	// If GM, 
	if (game.user.isGM) {
		
		/*
			Hook to listen for non player character going to 0 HP and hiding the token. 
		*/
		Hooks.on("updateActor", async (actor, updateData) => {
			if (actor.type === "character") return;

			const newHp = foundry.utils.getProperty(actor, "system.attributes.hp.value");
			const hpChanged = foundry.utils.hasProperty(updateData, "system.attributes.hp.value");
			if (!hpChanged) return;

			const action = game.settings.get("joes-pf2e-stuff", "deadTokenAction");

			for (const token of actor.getActiveTokens(true)) {
				if (newHp === 0) {
					if (action === "hide") {
						if (!token.document.hidden) {
							await token.document.update({ hidden: true });
							console.log(`Hid token '${token.name}'`);
						}
					} else if (action === "blood") {
						if (typeof TokenMagic !== "undefined") {
							const params = [{
								filterType: "splash",
								filterId: "deadSplash",
								color: 0x900505,
								padding: 30,
								time: Math.random() * 1000,
								seed: Math.random() / 100,
								splashFactor: 2,
								spread: 5,
								blend: 1,
								dimX: 1,
								dimY: 1,
								cut: true,
								textureAlphaBlend: false
							}];
							await TokenMagic.addFilters(token, params);
							console.log(`Applied TokenMagic splash effect to '${token.name}'`);
						} else {
							console.warn("TokenMagic FX is not available");
						}
					}
				} else if (newHp > 0) {
					const updates = {};
					if (token.document.hidden) updates.hidden = false;
					if (Object.keys(updates).length > 0) {
						await token.document.update(updates);
					}

					// Remove TokenMagic filter if present
					if (typeof TokenMagic !== "undefined") {
						await TokenMagic.deleteFilters(token, "deadSplash");
						console.log(`Cleared TokenMagic effects from '${token.name}'`);
					}
				}
			}
		});
	}
});
