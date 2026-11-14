import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const quietConsole = { log() {}, warn() {}, error() {} };

function loadClass(file, className, globals = {}) {
    const context = vm.createContext({ console: quietConsole, ...globals });
    const source = readFileSync(resolve(root, file), "utf8");
    vm.runInContext(source + "\n;globalThis.__exported = " + className + ";", context, { filename: file });
    return context.__exported;
}

test("EventBus supports unsubscribe and one-shot listeners", () => {
    const EventBus = loadClass("assets/js/core/eventBus.js", "EventBus");
    const bus = new EventBus();
    const received = [];
    const unsubscribe = bus.on("signal", value => received.push(value));

    bus.emit("signal", "first");
    unsubscribe();
    bus.emit("signal", "ignored");
    assert.deepEqual(received, ["first"]);

    let onceCalls = 0;
    bus.once("single", () => {
        onceCalls++;
        bus.emit("single");
    });
    bus.emit("single");
    assert.equal(onceCalls, 1);
});

test("StorageManager preserves the previous version marker when no migration exists", () => {
    const values = new Map([
        ["detective_archive_version", "0.9.0"],
        ["detective_archive_progress", JSON.stringify({ solvedCases: ["case-001"] })]
    ]);
    const localStorage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
    let now = 1000;
    const StorageManager = loadClass("assets/js/core/storage.js", "StorageManager", {
        CONFIG: { version: "1.0.0" },
        localStorage,
        Date: { now: () => now++ }
    });
    const storage = new StorageManager();

    assert.equal(storage.versionMismatch, true);
    assert.equal(storage.savedVersion, "0.9.0");
    assert.equal(localStorage.getItem("detective_archive_version"), "0.9.0");
    assert.deepEqual(Array.from(storage.loadProgress().solvedCases), ["case-001"]);
});

test("GameTime rolls over midnight and notifies subscribers", () => {
    const GameTime = loadClass("assets/js/systems/gameTime.js", "GameTime", {
        CONFIG: { time: { dawn: 6, day: 9, dusk: 18, night: 22 } }
    });
    const clock = new GameTime(23, 50, 4);
    let change;
    clock.onChange(value => { change = value; });

    clock.advance(20);

    assert.equal(clock.hour, 0);
    assert.equal(clock.minute, 10);
    assert.equal(clock.day, 5);
    assert.equal(change.day, 5);
    assert.equal(change.period, "night");
});

test("GameTime.setTime notifies subscribers when a new case resets the clock", () => {
    const GameTime = loadClass("assets/js/systems/gameTime.js", "GameTime", {
        CONFIG: { time: { dawn: 6, day: 9, dusk: 18, night: 22 } }
    });
    const clock = new GameTime(3, 20, 2);
    let change = null;
    clock.onChange(value => { change = value; });

    clock.setTime(20, 0, 1);

    assert.deepEqual([clock.hour, clock.minute, clock.day], [20, 0, 1]);
    assert.equal(change.hour, 20);
    assert.equal(change.minute, 0);
    assert.equal(change.day, 1);
    assert.equal(change.period, "evening");
    assert.equal(change.periodChanged, true);
});

test("NPCManager places home-based witnesses at their actual home location", () => {
    const witness = {
        id: "ex_wife",
        name: "Anna",
        schedule: {
            awake: { start: 9, end: 23 },
            sleeps: { start: 23, end: 9 },
            atWork: null,
            locations: { work: null, home: "anna_apartment" }
        }
    };
    const getNPCById = id => id === "ex_wife" ? witness : null;
    const getLocationById = id => id === "anna_apartment" ? { id, parentLocation: null } : null;
    const events = { emit() {} };
    const inventory = { hasItem: () => false, hasInsight: () => false, evidence: [] };
    const gameTime = { hour: 10, getFormatted: () => "10:00" };
    const NPCManager = loadClass("assets/js/npc/npcManager.js", "NPCManager", { getNPCById, getLocationById, events });
    const manager = new NPCManager(gameTime, inventory);

    manager.loadNPCsForCase({ id: "case-002", npcs: ["ex_wife"] });

    assert.deepEqual(Array.from(manager.getNPCsAtLocation("anna_apartment"), npc => npc.id), ["ex_wife"]);
});

test("NPCManager selects and restores the correct case-specific bartender dialogue", () => {
    const bartender = {
        id: "bartender",
        name: "Joe",
        dialogueId: "dialogue-bartender",
        specialConditions: [{
            id: "case-two-dialogue",
            condition: "case:case-002",
            dialogueId: "dialogue-bartender-case2"
        }]
    };
    const getNPCById = id => id === "bartender" ? bartender : null;
    const events = { emit() {} };
    const inventory = { hasItem: () => false, hasInsight: () => false, evidence: [] };
    const gameTime = { hour: 20, getFormatted: () => "20:00" };
    const NPCManager = loadClass("assets/js/npc/npcManager.js", "NPCManager", { getNPCById, events });
    const manager = new NPCManager(gameTime, inventory);

    manager.loadNPCsForCase({ id: "case-002", npcs: ["bartender"] });
    assert.equal(manager.getDialogueForNPC("bartender"), "dialogue-bartender-case2");

    const restored = NPCManager.fromJSON(manager.toJSON(), gameTime, inventory);
    assert.equal(restored.getDialogueForNPC("bartender"), "dialogue-bartender-case2");

    restored.loadNPCsForCase({ id: "case-001", npcs: ["bartender"] });
    assert.equal(restored.getDialogueForNPC("bartender"), "dialogue-bartender");
});

test("CaseManager restores a legacy active-case ID and reapplies warrant unlocks", () => {
    const caseData = {
        id: "case-002",
        unlockConditions: [{
            locationId: "anna_apartment",
            requiresItem: "search_warrant",
            message: "Ордер подтверждён."
        }]
    };
    const getCaseById = id => id === "case-002" ? caseData : null;
    const getLocationById = id => id === "anna_apartment" ? { id, unlockedByDefault: false } : null;
    const emitted = [];
    const events = { emit: (name, data) => emitted.push({ name, data }) };
    const unlocked = new Set();
    const locationManager = {
        activeCase: null,
        setActiveCase(value) { this.activeCase = value; },
        unlockLocation(id) {
            const changed = !unlocked.has(id);
            unlocked.add(id);
            return changed;
        }
    };
    const inventory = { hasItem: id => id === "search_warrant" };
    const CaseManager = loadClass("assets/js/systems/caseManager.js", "CaseManager", {
        getCaseById, getLocationById, events
    });

    const manager = CaseManager.fromJSON(null, {}, locationManager, inventory, "case-002");

    assert.equal(manager.currentCase.id, "case-002");
    assert.equal(manager.caseState, "active");
    assert.equal(locationManager.activeCase.id, "case-002");
    assert.ok(unlocked.has("anna_apartment"));
    assert.ok(emitted.some(event => event.name === "notification:show"));

    const staleSnapshot = {
        currentCaseId: "case-001",
        caseState: "solved",
        completedEvents: ["old-case-event"],
        visitedLocations: ["old-location"],
        evidenceFound: 9
    };
    const recovered = CaseManager.fromJSON(staleSnapshot, {}, locationManager, inventory, "case-002");
    assert.equal(recovered.currentCase.id, "case-002");
    assert.equal(recovered.caseState, "active");
    assert.deepEqual(Array.from(recovered.completedEvents), []);
    assert.deepEqual(Array.from(recovered.visitedLocations), []);
    assert.equal(recovered.evidenceFound, 0);
});

test("NPCManager rebuilds missing saved contacts from the active case", () => {
    const npcs = {
        bartender: { id: "bartender", name: "Joe", dialogueId: "dialogue-bartender", schedule: { locations: { home: "bar_joe" } } },
        ex_wife: { id: "ex_wife", name: "Anna", dialogueId: "dialogue-anna", schedule: { locations: { home: "anna_apartment" } } }
    };
    const caseData = { id: "case-002", npcs: ["bartender", "ex_wife"] };
    const getCaseById = id => id === "case-002" ? caseData : null;
    const getNPCById = id => npcs[id] || null;
    const NPCManager = loadClass("assets/js/npc/npcManager.js", "NPCManager", {
        getCaseById, getNPCById, events: { emit() {} }
    });

    const manager = NPCManager.fromJSON(null, { hour: 10 }, {}, "case-002");

    assert.deepEqual(Array.from(manager.activeNPCs, npc => npc.id), ["bartender", "ex_wife"]);
    assert.deepEqual(Array.from(Object.keys(manager.npcStates).sort()), ["bartender", "ex_wife"]);
    assert.equal(manager.currentCaseId, "case-002");

    const stale = NPCManager.fromJSON({
        currentCaseId: "case-001",
        activeNPCs: ["porter"],
        npcStates: { porter: { dialoguesCompleted: ["old-dialogue"] } }
    }, { hour: 10 }, {}, "case-002");
    assert.deepEqual(Array.from(stale.activeNPCs, npc => npc.id), ["bartender", "ex_wife"]);
    assert.deepEqual(Array.from(Object.keys(stale.npcStates).sort()), ["bartender", "ex_wife"]);
});

test("Starting a new case does not charge travel time from the previous case", () => {
    const caseData = {
        id: "case-001",
        title: "Test case",
        startTime: { hour: 20, minute: 0, day: 1 },
        locations: ["police_station"],
        startLocation: "police_station",
        events: []
    };
    const getCaseById = id => id === "case-001" ? caseData : null;
    const getLocationById = id => id === "police_station" ? { id, unlockedByDefault: true } : null;
    const events = { emit() {} };
    const gameTime = {
        hour: 3, minute: 20, day: 2,
        advance(minutes) { this.minute += minutes; }
    };
    const locationManager = {
        currentLocation: "bar_joe",
        setActiveCase() {},
        unlockLocation() { return true; },
        travelTo(id) {
            if (this.currentLocation && this.currentLocation !== id) gameTime.advance(15);
            this.currentLocation = id;
            return true;
        }
    };
    const CaseManager = loadClass("assets/js/systems/caseManager.js", "CaseManager", {
        getCaseById, getLocationById, events, CONFIG: { time: { costs: { travel: 15 } } }
    });
    const manager = new CaseManager(gameTime, locationManager, { hasItem: () => false });

    assert.equal(manager.loadCase("case-001"), true);
    assert.deepEqual([gameTime.hour, gameTime.minute, gameTime.day], [20, 0, 1]);
    assert.equal(locationManager.currentLocation, "police_station");
});

test("Case start times match the authored evening and after-midnight timelines", () => {
    const caseOne = loadClass("assets/data/cases/case-001/index.js", "CASE_001");
    const caseTwo = loadClass("assets/data/cases/case-002/index.js", "CASE_002");

    assert.equal(caseOne.startTime.hour, 20);
    assert.equal(caseOne.startTime.minute, 0);
    assert.equal(caseTwo.startTime.hour, 0);
    assert.equal(caseTwo.startTime.minute, 30);
});

test("EvidenceChainSystem loads registered chains and preserves completion on restore", () => {
    const registered = {
        "case-two-main": {
            id: "case-two-main",
            caseId: "case-002",
            name: "Путь яда",
            requiredEvidence: ["poison_vial"],
            requiredInsights: ["full_poison_path"]
        }
    };
    const EvidenceChainSystem = loadClass("assets/js/systems/evidenceChain.js", "EvidenceChainSystem", {
        window: { EVIDENCE_CHAINS: registered }
    });
    const inventory = { hasItem: () => false, hasInsight: () => false };
    const system = new EvidenceChainSystem(inventory);

    system.loadChainsForCase({
        id: "case-002",
        evidenceChains: [{ id: "legacy-inline-chain", name: "Legacy", requiredEvidence: [] }]
    });
    assert.deepEqual(Array.from(system.chains, chain => chain.id), ["case-two-main"]);

    system.completedChains.push("case-two-main");
    const restored = EvidenceChainSystem.fromJSON(system.toJSON(), inventory, "case-002");
    restored.loadChainsForCase({ id: "case-002", evidenceChains: [] }, true);
    assert.deepEqual(Array.from(restored.completedChains), ["case-two-main"]);

    restored.loadChainsForCase({ id: "case-001", evidenceChains: [] });
    assert.equal(restored.completedChains.length, 0);

    const stale = EvidenceChainSystem.fromJSON({
        currentCaseId: "case-001",
        completedChains: ["case-one-chain"]
    }, inventory, "case-002");
    stale.loadChainsForCase({ id: "case-002", evidenceChains: [] }, true);
    assert.deepEqual(Array.from(stale.completedChains), []);
});

test("AlternateEndings selects authored perfect, partial and failed outcomes", () => {
    const endings = {
        "case-two-perfect": { id: "perfect", caseId: "case-002", condition: "full_confession_kane" },
        "case-two-partial": { id: "partial", caseId: "case-002", condition: "evidence_count_4" },
        "case-two-failed": { id: "failed", caseId: "case-002", condition: "default" }
    };
    const AlternateEndings = loadClass("assets/js/systems/alternateEndings.js", "AlternateEndings", {
        window: { ENDINGS: endings }
    });
    const system = new AlternateEndings();

    assert.equal(system.determineEnding({ id: "case-002" }, { hasInsight: id => id === "full_confession_kane" }, 1).id, "perfect");
    assert.equal(system.determineEnding({ id: "case-002" }, { hasInsight: () => false }, 4).id, "partial");
    assert.equal(system.determineEnding({ id: "case-002" }, { hasInsight: () => false }, 2).id, "failed");
});

test("ProgressTracker records a solved case and restores an active run", () => {
    const events = { emit() {} };
    const CONFIG = {
        ranks: [
            { name: "СТАЖЁР", minSolved: 0 },
            { name: "ДЕТЕКТИВ", minSolved: 1 }
        ]
    };
    const ProgressTracker = loadClass("assets/js/systems/progressTracker.js", "ProgressTracker", { events, CONFIG });
    const tracker = new ProgressTracker();

    tracker.startCase("case-001");
    tracker.caseStartTime = Date.now() - 120000;
    tracker.caseHintsUsed = 1;
    tracker.caseAttempts = 2;
    const record = tracker.caseSolved({ id: "case-001", title: "Первое дело" });

    assert.equal(tracker.stats.totalCasesSolved, 1);
    assert.equal(record.result, "solved");
    assert.ok(record.timeSpent >= 1);
    assert.equal(tracker.caseStartTime, null);

    tracker.startCase("case-002");
    tracker.caseHintsUsed = 2;
    tracker.caseAttempts = 3;
    const restored = ProgressTracker.fromJSON(tracker.toJSON());

    assert.equal(restored.caseHintsUsed, 2);
    assert.equal(restored.caseAttempts, 3);
    assert.equal(restored.caseStartTime, tracker.caseStartTime);
});

test("CaseManager uses the evidence threshold declared by each case", () => {
    const emitted = [];
    const events = { emit: (name, data) => emitted.push({ name, data }) };
    const CaseManager = loadClass("assets/js/systems/caseManager.js", "CaseManager", { events });
    const manager = new CaseManager({}, {}, {});
    manager.currentCase = {
        events: [{ id: "final-ready", trigger: "evidence_count:4", type: "notification", message: "Готово" }]
    };

    manager.evidenceFound = 3;
    manager._checkEvidenceCount();
    assert.equal(emitted.some(event => event.name === "case:ready_for_final"), false);

    manager.evidenceFound = 4;
    manager._checkEvidenceCount();
    assert.ok(emitted.some(event => event.name === "case:ready_for_final" && event.data === true));
});

test("LocationManager adds active case scene objects without duplicating base items", () => {
    const locations = {
        bar_joe: { id: "bar_joe", defaultItems: ["bar_counter", "jukebox"], nightOnlyItems: ["hidden_suitcase"] }
    };
    const getLocationById = id => locations[id] || null;
    const window = {};
    const LocationManager = loadClass("assets/js/systems/locationManager.js", "LocationManager", {
        getLocationById,
        window
    });
    const gameTime = { hour: 23, isNighttime: () => true };
    const manager = new LocationManager(gameTime);
    manager.setActiveCase({
        id: "case-002",
        scenes: [{
            locationId: "bar_joe",
            highlightObjects: ["overturned_glass", "red_scarf"],
            nightOnlyObjects: ["hidden_suitcase"]
        }, {
            locationId: "bar_joe",
            highlightObjects: ["case_note"]
        }]
    });

    assert.deepEqual(
        Array.from(manager.getLocationItems("bar_joe")),
        ["bar_counter", "jukebox", "overturned_glass", "red_scarf", "case_note", "hidden_suitcase"]
    );
});

test("Inventory can restore a collected clue to the available evidence pool", () => {
    const objects = {
        magnifying_glass: { id: "magnifying_glass", takeable: true, weight: 1 },
        evidence_note: { id: "evidence_note", name: "Записка", takeable: true, isEvidence: true, weight: 1 }
    };
    const emitted = [];
    const events = { emit: (name, data) => emitted.push({ name, data }) };
    const getObjectById = id => objects[id] || null;
    const getObjectsByIds = ids => ids.map(getObjectById).filter(Boolean);
    const Inventory = loadClass("assets/js/systems/inventory.js", "Inventory", { events, getObjectById, getObjectsByIds });
    const inventory = new Inventory();

    assert.equal(inventory.addItem("evidence_note"), true);
    assert.equal(inventory.removeFromEvidence("evidence_note"), true);
    assert.equal(inventory.evidence.includes("evidence_note"), false);
    assert.equal(inventory.addToEvidence("evidence_note"), true);
    assert.equal(inventory.evidence.includes("evidence_note"), true);
    assert.equal(inventory.addToEvidence("evidence_note"), false);
    assert.ok(emitted.some(event => event.name === "inventory:changed" && event.data.action === "restore_evidence"));
});

test("InvestigationBoard returns clues when a slot is cleared or the board is reset", () => {
    const emitted = [];
    const events = { emit: (name, data) => emitted.push({ name, data }) };
    const getObjectById = id => id === "evidence_note" ? { id, isEvidence: true } : null;
    const InvestigationBoard = loadClass("assets/js/systems/board.js", "InvestigationBoard", { events, getObjectById });
    const board = new InvestigationBoard();

    assert.equal(board.placeEvidence("evidence_note", "slot-1"), true);
    assert.equal(board.removeEvidence("slot-1"), "evidence_note");
    assert.ok(emitted.some(event => event.name === "inventory:restore_evidence" && event.data === "evidence_note"));

    board.placeEvidence("evidence_note", "slot-2");
    board.reset();
    assert.equal(board.evidenceOnBoard.length, 0);
    assert.equal(emitted.filter(event => event.name === "inventory:restore_evidence").length, 2);
});

test("StorageManager increments sync revision only when progress changes", () => {
    const values = new Map();
    const localStorage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
    let now = 1000;
    const StorageManager = loadClass("assets/js/core/storage.js", "StorageManager", {
        CONFIG: { version: "1.0.0" },
        localStorage,
        Date: { now: () => now++ }
    });
    const storage = new StorageManager();

    storage.saveProgress({ activeCase: null, solvedCases: [] });
    const first = storage.loadProgress();
    storage.saveProgress({ activeCase: null, solvedCases: [] });
    const unchanged = storage.loadProgress();
    storage.saveProgress({ activeCase: "case-001", solvedCases: [] });
    const changed = storage.loadProgress();

    assert.equal(unchanged._sync.revision, first._sync.revision);
    assert.equal(unchanged._sync.updatedAt, first._sync.updatedAt);
    assert.equal(changed._sync.revision, unchanged._sync.revision + 1);
    assert.ok(changed._sync.updatedAt >= unchanged._sync.updatedAt);
});

test("SyncManager preserves an active local case when cloud progress is newer", async () => {
    const emitted = [];
    const events = { on() {}, emit: (name, data) => emitted.push({ name, data }) };
    const state = {
        progress: { activeCase: "case-001", solvedCases: [], _sync: { revision: 2, updatedAt: 100 } }
    };
    const storage = {
        get: key => state[key] ?? null,
        set: (key, value) => { state[key] = value; return true; },
        remove: key => { delete state[key]; },
        loadProgress: () => state.progress,
        saveProgress: data => { state.progress = data; return true; }
    };
    let cloudWrites = 0;
    const cloudData = { activeCase: null, solvedCases: [], _sync: { revision: 3, updatedAt: 200 } };
    const cloudStorage = {
        loadFromCloud: async () => cloudData,
        saveToCloud: async () => { cloudWrites++; return true; }
    };
    const SyncManager = loadClass("assets/js/firebase/syncManager.js", "SyncManager", { events });
    const manager = new SyncManager({ isUserLoggedIn: () => true }, cloudStorage, storage);

    await manager.syncFromCloud();

    assert.equal(state.progress.activeCase, "case-001");
    assert.equal(state.cloud_conflict_backup, cloudData);
    assert.equal(manager.hasConflict, true);
    assert.equal(cloudWrites, 0);
    assert.ok(emitted.some(event => event.name === "sync:conflict"));

    const resolved = await manager.resolveConflict("cloud");
    assert.equal(resolved, true);
    assert.equal(state.progress.activeCase, null);
    assert.equal(state.cloud_conflict_backup, undefined);
    assert.ok(emitted.some(event => event.name === "sync:reload_needed"));
});
