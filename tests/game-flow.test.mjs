import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(new URL("..", import.meta.url).pathname);
const quietConsole = { log() {}, warn() {}, error() {} };

function createRuntime() {
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    const dataScripts = [...html.matchAll(/<script src="(assets\/data\/[^"]+\.js)"><\/script>/g)]
        .map(match => match[1])
        .filter(path => path === "assets/data/core-init.js" ||
            path === "assets/data/cases/case-index.js" ||
            path.startsWith("assets/data/cases/case-001/") ||
            path.startsWith("assets/data/cases/case-002/"));

    const context = vm.createContext({ console: quietConsole, window: {} });
    const scripts = [
        "assets/js/core/config.js",
        "assets/js/core/eventBus.js",
        ...dataScripts,
        "assets/js/systems/gameTime.js",
        "assets/js/systems/locationManager.js",
        "assets/js/systems/inventory.js",
        "assets/js/systems/caseManager.js",
        "assets/js/systems/evidenceChain.js",
        "assets/js/systems/alternateEndings.js",
        "assets/js/npc/npcManager.js"
    ];

    for (const path of scripts) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }

    const systems = vm.runInContext(`(() => {
        const gameTime = new GameTime(8, 0, 1);
        const locationManager = new LocationManager(gameTime);
        const inventory = new Inventory();
        const caseManager = new CaseManager(gameTime, locationManager, inventory);
        const npcManager = new NPCManager(gameTime, inventory);
        const evidenceChains = new EvidenceChainSystem(inventory);
        const endings = new AlternateEndings();
        return { gameTime, locationManager, inventory, caseManager, npcManager, evidenceChains, endings };
    })()`, context);

    const events = vm.runInContext("events", context);
    events.on("inventory:changed", data => {
        if (data?.action === "add") systems.caseManager.onItemAcquired(data.itemId);
        systems.evidenceChains.checkChains();
    });
    events.on("insight:gained", data => {
        systems.caseManager.onInsightGained(data.insightId);
        systems.evidenceChains.checkChains();
    });
    events.on("object:interact", data => {
        const object = vm.runInContext(`getObjectById(${JSON.stringify(data.itemId)})`, context);
        if (!object) return;
        if (object.takeable && !systems.inventory.hasItem(data.itemId)) {
            systems.inventory.addItem(data.itemId);
        }
        const examine = object.interactions?.examine;
        if (examine?.spawnsItem && !systems.inventory.hasItem(examine.spawnsItem)) {
            systems.inventory.addItem(examine.spawnsItem);
        }
        if (examine?.givesInsight) systems.inventory.addInsight(examine.givesInsight);
    });

    return { context, systems, events };
}

test("Case 001 runtime loads its authored scenes, contacts, clue chains and endings", () => {
    const { context, systems } = createRuntime();
    const { gameTime, locationManager, caseManager, npcManager, evidenceChains, endings } = systems;

    assert.equal(caseManager.loadCase("case-001"), true);
    const caseData = vm.runInContext('getCaseById("case-001")', context);
    npcManager.loadNPCsForCase(caseData);
    evidenceChains.loadChainsForCase(caseData);

    assert.deepEqual([gameTime.hour, gameTime.minute], [20, 0]);
    assert.equal(locationManager.currentLocation, "police_station");
    assert.ok(locationManager.getLocationItems("hotel_room_304").includes("mirror"));
    assert.equal(evidenceChains.chains.length, 3);
    assert.equal(npcManager.getDialogueForNPC("bartender"), "dialogue-bartender");
    assert.equal(Object.values(context.window.ENDINGS).filter(item => item.caseId === "case-001").length, 3);
    assert.equal(endings.determineEnding(caseData, systems.inventory, 0).id, "case-001-failed");
});

test("Case 002 runtime routes the bartender, exposes the crime-scene clue and unlocks the apartment with a warrant", () => {
    const { context, systems, events } = createRuntime();
    const { gameTime, locationManager, inventory, caseManager, npcManager, evidenceChains, endings } = systems;

    assert.equal(caseManager.loadCase("case-002"), true);
    const caseData = vm.runInContext('getCaseById("case-002")', context);
    npcManager.loadNPCsForCase(caseData);
    evidenceChains.loadChainsForCase(caseData);

    assert.deepEqual([gameTime.hour, gameTime.minute], [0, 30]);
    assert.ok(locationManager.getLocationItems("bar_joe").includes("overturned_glass"));
    assert.ok(locationManager.getLocationItems("bar_joe").includes("red_scarf"));
    assert.equal(npcManager.getDialogueForNPC("bartender"), "dialogue-bartender-case2");
    assert.equal(evidenceChains.chains.length, 3);

    events.emit("object:interact", { itemId: "overturned_glass", locationId: "bar_joe" });
    assert.ok(inventory.hasItem("overturned_glass"));
    assert.ok(inventory.hasItem("poison_vial"));
    assert.ok(inventory.hasInsight("cyanide_poison"));
    assert.equal(caseManager.evidenceFound, 2);

    assert.equal(inventory.addItem("search_warrant"), true);
    assert.ok(locationManager.unlockedLocations.has("anna_apartment"));
    assert.ok(locationManager.unlockedLocations.has("bank"));

    const poisonChain = evidenceChains.chains.find(chain => chain.id === "chain_002_poison_path");
    poisonChain.requiredEvidence.forEach(id => {
        if (!inventory.items.includes(id)) inventory.items.push(id);
    });
    poisonChain.requiredInsights.forEach(id => {
        if (!inventory.insights.includes(id)) inventory.insights.push(id);
    });
    evidenceChains.checkChains();
    assert.ok(evidenceChains.completedChains.includes("chain_002_poison_path"));
    assert.ok(inventory.hasInsight("full_poison_path"));

    const perfect = endings.determineEnding(caseData, {
        hasInsight: id => id === "full_confession_kane",
        items: inventory.items
    }, caseManager.evidenceFound);
    assert.equal(perfect.id, "case-002-perfect");
});
