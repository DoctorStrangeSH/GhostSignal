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
        specialConditions: []
    };
    const cases = {
        "case-001": { id: "case-001", npcs: ["bartender"] },
        "case-002": {
            id: "case-002",
            npcs: ["bartender"],
            npcDialogueOverrides: { bartender: "dialogue-bartender-case2" }
        }
    };
    const getNPCById = id => id === "bartender" ? bartender : null;
    const getCaseById = id => cases[id] || null;
    const events = { emit() {} };
    const inventory = { hasItem: () => false, hasInsight: () => false, evidence: [] };
    const gameTime = { hour: 20, getFormatted: () => "20:00" };
    const NPCManager = loadClass("assets/js/npc/npcManager.js", "NPCManager", { getNPCById, getCaseById, events });
    const manager = new NPCManager(gameTime, inventory);

    manager.loadNPCsForCase(cases["case-002"]);
    assert.equal(manager.getDialogueForNPC("bartender"), "dialogue-bartender-case2");

    const restored = NPCManager.fromJSON(manager.toJSON(), gameTime, inventory);
    assert.equal(restored.getDialogueForNPC("bartender"), "dialogue-bartender-case2");

    restored.loadNPCsForCase(cases["case-001"]);
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
        finalQuestion: { title: "Обвинение" },
        events: [{ id: "final-ready", trigger: "evidence_count:4", type: "notification", message: "Готово" }]
    };
    manager.caseState = "active";

    manager.evidenceFound = 3;
    manager._checkEvidenceCount();
    assert.equal(emitted.some(event => event.name === "case:ready_for_final"), false);

    manager.evidenceFound = 4;
    manager._checkEvidenceCount();
    assert.ok(emitted.some(event => event.name === "case:ready_for_final" && event.data === true));
});

test("Starting a different case resets only case-scoped location unlocks and visits", () => {
    const locations = {
        police_station: { id: "police_station", unlockedByDefault: true, hours: { open: 0, close: 24 } },
        case_one_secret: { id: "case_one_secret", unlockedByDefault: false, hours: { open: 0, close: 24 } },
        case_two_public: { id: "case_two_public", unlockedByDefault: true, hours: { open: 0, close: 24 } }
    };
    const cases = {
        "case-002": {
            id: "case-002",
            title: "Second investigation",
            startTime: { hour: 10, minute: 0, day: 1 },
            locations: ["case_two_public"],
            startLocation: "case_two_public",
            events: []
        }
    };
    const emitted = [];
    const events = { emit: (name, data) => emitted.push({ name, data }) };
    const getLocationById = id => locations[id] || null;
    const getCaseById = id => cases[id] || null;
    const globals = { events, getLocationById, getCaseById, CONFIG: { time: { costs: { travel: 15 } } }, window: {} };
    const LocationManager = loadClass("assets/js/systems/locationManager.js", "LocationManager", globals);
    const CaseManager = loadClass("assets/js/systems/caseManager.js", "CaseManager", globals);
    const gameTime = {
        hour: 3, minute: 20, day: 2,
        setTime(hour, minute, day) { this.hour = hour; this.minute = minute; this.day = day; },
        getFormatted() { return "10:00"; },
        advance(minutes) { this.minute += minutes; }
    };
    const locationManager = new LocationManager(gameTime);
    locationManager.unlockCaseLocation("case_one_secret");
    locationManager.unlockLocation("train_station");
    locationManager.visitedLocations.add("case_one_secret");
    locationManager.currentLocation = "case_one_secret";
    const manager = new CaseManager(gameTime, locationManager, { hasItem: () => false });

    assert.equal(manager.loadCase("case-002"), true);
    assert.equal(locationManager.unlockedLocations.has("case_one_secret"), false);
    assert.equal(locationManager.unlockedLocations.has("case_two_public"), true);
    assert.equal(locationManager.unlockedLocations.has("train_station"), true,
        "permanent ending rewards must survive a new investigation");
    assert.equal(locationManager.caseUnlockedLocations.has("case_two_public"), true);
    assert.equal(locationManager.permanentUnlockedLocations.has("train_station"), true);
    assert.deepEqual(Array.from(locationManager.visitedLocations), ["case_two_public"]);
    assert.equal(locationManager.currentLocation, "case_two_public");
    assert.equal(locationManager.activeCaseData.id, "case-002");

    // Restoring a save must not invoke the fresh-run reset or discard map progress.
    locationManager.unlockedLocations.add("case_two_saved_unlock");
    locationManager.visitedLocations.add("case_two_saved_unlock");
    locationManager.setActiveCase(cases["case-002"]);
    assert.equal(locationManager.unlockedLocations.has("case_two_saved_unlock"), true);
    assert.equal(locationManager.visitedLocations.has("case_two_saved_unlock"), true);

    const snapshot = locationManager.toJSON();
    const restored = LocationManager.fromJSON(snapshot, gameTime);
    assert.equal(restored.unlockedLocations.has("train_station"), true);
    assert.equal(restored.permanentUnlockedLocations.has("train_station"), true);
    assert.equal(restored.caseUnlockedLocations.has("case_two_public"), true);

    const legacy = LocationManager.fromJSON({
        unlockedLocations: ["train_station", "legacy_case_unlock"]
    }, gameTime);
    legacy.beginCase({ id: "case-003" });
    assert.equal(legacy.unlockedLocations.has("train_station"), true,
        "legacy saves preserve ambiguous unlocks rather than deleting progress");
    assert.equal(legacy.unlockedLocations.has("legacy_case_unlock"), true);
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
    board.setCase("case-001");

    assert.equal(board.placeEvidence("evidence_note", "slot-1"), true);
    const placement = emitted.find(event => event.name === "board:updated" && event.data.action === "place");
    assert.deepEqual(
        { caseId: placement.data.caseId, filledSlots: placement.data.filledSlots, totalSlots: placement.data.totalSlots },
        { caseId: "case-001", filledSlots: 1, totalSlots: 6 }
    );
    assert.equal(board.removeEvidence("slot-1"), "evidence_note");
    assert.ok(emitted.some(event => event.name === "inventory:restore_evidence" && event.data === "evidence_note"));

    board.placeEvidence("evidence_note", "slot-2");
    board.reset();
    assert.equal(board.evidenceOnBoard.length, 0);
    assert.equal(emitted.filter(event => event.name === "inventory:restore_evidence").length, 2);
});

test("placing a required clue on the board does not invalidate an accusation", () => {
    const objects = {
        hidden_note: { id: "hidden_note", name: "Записка", takeable: true, isEvidence: true, weight: 0 },
        wire_fragment: { id: "wire_fragment", name: "Проволока", takeable: true, isEvidence: true, weight: 0 }
    };
    let inventory;
    const events = { emit(name, id) {
        if (name === "inventory:remove") inventory.removeFromEvidence(id);
        if (name === "inventory:restore_evidence") inventory.addToEvidence(id);
    } };
    const getObjectById = id => objects[id] || null;
    const getObjectsByIds = ids => ids.map(getObjectById).filter(Boolean);
    const Inventory = loadClass("assets/js/systems/inventory.js", "Inventory", { events, getObjectById, getObjectsByIds });
    const InvestigationBoard = loadClass("assets/js/systems/board.js", "InvestigationBoard", { events, getObjectById });
    const CaseManager = loadClass("assets/js/systems/caseManager.js", "CaseManager", { events });
    inventory = new Inventory();
    inventory.addItem("hidden_note");
    inventory.addItem("wire_fragment");
    inventory.addInsight("victim_knew_danger");

    const board = new InvestigationBoard();
    assert.equal(board.placeEvidence("hidden_note", "slot-1"), true);
    assert.equal(board.placeEvidence("wire_fragment", "slot-2"), true);
    assert.equal(inventory.evidence.length, 0, "board clues leave the available evidence pool");
    assert.equal(inventory.hasItem("hidden_note"), true, "ownership survives board placement");

    const manager = new CaseManager(null, null, inventory);
    manager.currentCase = {
        id: "test-case",
        proofRequirements: { requiredItems: ["hidden_note", "wire_fragment"], anyInsights: ["victim_knew_danger"] },
        finalQuestion: { acceptableAnswers: ["мэри"], feedbackCorrect: { title: "Верно" }, feedbackIncorrect: { title: "Нет" } }
    };
    manager.caseState = "active";
    assert.equal(manager.checkFinalAnswer("мэри").isCorrect, true);
    assert.equal(manager.caseState, "solved");
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
    assert.equal(JSON.stringify(state.cloud_conflict_backup.cloud), JSON.stringify(cloudData));
    assert.equal(JSON.stringify(state.cloud_conflict_backup.local), JSON.stringify({ activeCase: "case-001", solvedCases: [], _sync: { revision: 2, updatedAt: 100 } }));
    assert.equal(manager.hasConflict, true);
    assert.equal(cloudWrites, 0);
    assert.ok(emitted.some(event => event.name === "sync:conflict"));

    const resolved = await manager.resolveConflict("cloud");
    assert.equal(resolved, true);
    assert.equal(state.progress.activeCase, null);
    assert.equal(state.cloud_conflict_backup, undefined);
    assert.ok(emitted.some(event => event.name === "sync:reload_needed"));
});


test("ProgressTracker records each replay once while counting a case only once for rank", () => {
    const events = { emit() {} };
    const CONFIG = { ranks: [{ name: "СТАЖЁР", minSolved: 0 }, { name: "ДЕТЕКТИВ", minSolved: 1 }] };
    const ProgressTracker = loadClass("assets/js/systems/progressTracker.js", "ProgressTracker", { events, CONFIG });
    const tracker = new ProgressTracker();
    const caseData = { id: "case-002", title: "Последний заказ" };

    tracker.startCase(caseData.id, "case-002:run-1");
    tracker.caseStartTime = Date.now() - 120000;
    const first = tracker.caseSolved(caseData, "case-002:run-1");
    const duplicate = tracker.caseSolved(caseData, "case-002:run-1");

    assert.equal(duplicate, first, "the same run cannot be counted twice");
    assert.equal(tracker.stats.totalCasesSolved, 1, "unique solved cases drive rank progression");
    assert.equal(tracker.stats.totalSolvedRuns, 1);
    assert.equal(tracker.stats.casesHistory.length, 1);

    tracker.startCase(caseData.id, "case-002:run-2");
    tracker.caseHintsUsed = 2;
    const replay = tracker.caseSolved(caseData, "case-002:run-2");
    assert.equal(replay.runId, "case-002:run-2");
    assert.equal(tracker.stats.totalCasesSolved, 1, "replaying a solved case does not farm rank");
    assert.equal(tracker.stats.totalSolvedRuns, 2);
    assert.equal(tracker.stats.casesHistory.length, 2);
    assert.equal(tracker.getSolveRate(), 100);

    const restored = ProgressTracker.fromJSON(tracker.toJSON());
    assert.equal(restored.stats.totalSolvedRuns, 2);
    assert.deepEqual(Array.from(restored.stats.casesHistory, record => record.runId), [
        "case-002:run-1", "case-002:run-2"
    ]);
});


test("ProgressTracker keeps failed replay attempts separate and deduplicates the same failed run", () => {
    const events = { emit() {} };
    const CONFIG = { ranks: [{ name: "СТАЖЁР", minSolved: 0 }] };
    const ProgressTracker = loadClass("assets/js/systems/progressTracker.js", "ProgressTracker", { events, CONFIG });
    const tracker = new ProgressTracker();
    const caseData = { id: "case-001", title: "Номер 304" };

    tracker.startCase(caseData.id, "case-001:failed-run-1");
    const first = tracker.caseFailed(caseData, "case-001:failed-run-1");
    assert.equal(tracker.caseFailed(caseData, "case-001:failed-run-1"), first);
    tracker.startCase(caseData.id, "case-001:failed-run-2");
    tracker.caseFailed(caseData, "case-001:failed-run-2");

    assert.equal(tracker.stats.totalCasesFailed, 2);
    assert.equal(tracker.stats.casesHistory.filter(record => record.result === "failed").length, 2);
    assert.equal(tracker.stats.casesHistory[0].runId, "case-001:failed-run-1");
    assert.equal(tracker.stats.casesHistory[1].runId, "case-001:failed-run-2");
    assert.equal(tracker.getSolveRate(), 0);
});


test("ProgressTracker preserves the ending reached in each solved playthrough", () => {
    const events = { emit() {} };
    const CONFIG = { ranks: [{ name: "СТАЖЁР", minSolved: 0 }] };
    const ProgressTracker = loadClass("assets/js/systems/progressTracker.js", "ProgressTracker", { events, CONFIG });
    const tracker = new ProgressTracker();
    tracker.startCase("case-001", "case-001:ending-run");
    const ending = { id: "truth", title: "Полная правда", text: "Кейн признался." };
    const record = tracker.caseSolved({ id: "case-001", title: "Номер 304" }, "case-001:ending-run", ending);

    assert.equal(record.endingId, "truth");
    assert.equal(record.endingTitle, "Полная правда");
    assert.equal(record.endingText, "Кейн признался.");
    const restored = ProgressTracker.fromJSON(tracker.toJSON());
    assert.equal(restored.stats.casesHistory[0].endingTitle, "Полная правда");
});

test("CaseArchiveUI sorts saved runs and escapes untrusted archive text", () => {
    const CaseArchiveUI = loadClass("assets/js/ui/caseArchiveUI.js", "CaseArchiveUI", {
        document: { getElementById: () => null }
    });
    const archive = new CaseArchiveUI("archive");
    archive.setProgress({ trackerData: { stats: { casesHistory: [
        { runId: "older", caseId: "case-001", title: "Старое дело", result: "failed", date: "2026-01-01T00:00:00.000Z" },
        { runId: "newer", caseId: "case-002", title: "<script>alert(1)</script>", result: "solved", date: "2026-02-01T00:00:00.000Z" }
    ] } } });

    assert.deepEqual(Array.from(archive._records(), record => record.runId), ["newer", "older"]);
    assert.equal(archive._escape('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});


test("Case archive ending codex reveals only endings present in completed-run history", () => {
    const container = {
        innerHTML: "",
        querySelector: () => null,
        querySelectorAll: () => []
    };
    const CaseArchiveUI = loadClass("assets/js/ui/caseArchiveUI.js", "CaseArchiveUI", {
        document: { getElementById: () => container },
        window: { ENDINGS: {
            ending_found: { id: "ending_found", caseId: "case-001", title: "Истина раскрыта", text: "Скрытый текст найден." },
            ending_hidden: { id: "ending_hidden", caseId: "case-001", title: "Секретная развязка", text: "Секрет." }
        } },
        events: { emit() {} }
    });
    const archive = new CaseArchiveUI("archive");
    archive._renderEndings([
        { runId: "run-1", caseId: "case-001", result: "solved", endingId: "ending_found", endingTitle: "Истина раскрыта", endingText: "Скрытый текст найден." }
    ]);

    assert.match(container.innerHTML, /Истина раскрыта/);
    assert.match(container.innerHTML, /НЕИЗВЕСТНАЯ КОНЦОВКА/);
    assert.doesNotMatch(container.innerHTML, /Секретная развязка/);
    assert.match(container.innerHTML, /ОТКРЫТО/);
});


test("AchievementSystem unlocks data-driven run achievements once and persists them in progress", () => {
    const emitted = [];
    const events = { emit: (name, payload) => emitted.push({ name, payload }) };
    const storageWrites = [];
    const storage = { set: (key, value) => storageWrites.push({ key, value: [...value] }) };
    const caseData = {
        id: "case-001",
        achievements: [
            { id: "case_001_full_truth", name: "Человек найден", description: "Добейтесь полной концовки.", icon: "🗝️", rarity: "epic", criteria: { type: "ending_id", endingId: "case-001-perfect" } },
            { id: "case_001_clean_work", name: "Без лишнего шума", description: "Раскройте дело без подсказок.", icon: "🕯️", rarity: "rare", criteria: { type: "case_no_hints", caseId: "case-001" } }
        ]
    };
    const progress = {
        solvedCases: ["case-001"],
        trackerData: { stats: { casesHistory: [] } },
        reputationData: { reputation: 75 }
    };
    const AchievementSystem = loadClass("assets/js/systems/achievements.js", "AchievementSystem", {
        events, storage, CASES_INDEX: { "case-001": caseData }
    });
    const system = new AchievementSystem(progress, events);
    system.load(null, ["first_case"]);

    const firstRun = {
        runId: "case-001:run-1", caseId: "case-001", result: "solved",
        hintsUsed: 0, attempts: 1, endingId: "case-001-perfect"
    };
    progress.trackerData.stats.casesHistory.push(firstRun);
    const unlocked = system.checkAll({ caseData, runRecord: firstRun, ending: { id: firstRun.endingId } });

    assert.ok(unlocked.some(record => record.id === "no_hints"));
    assert.ok(unlocked.some(record => record.id === "perfect_case"));
    assert.ok(unlocked.some(record => record.id === "case_001_full_truth"));
    assert.ok(unlocked.some(record => record.id === "case_001_clean_work"));
    assert.ok(system.unlocked.includes("first_case"), "legacy local achievements remain unlocked");
    assert.equal(system.checkAll({ caseData, runRecord: firstRun }).length, 0, "rechecking one run does not duplicate rewards");
    assert.equal(progress.achievementData.unlocked.length, system.unlocked.length);
    assert.ok(storageWrites.length >= 1);
    assert.ok(emitted.some(event => event.name === "achievement:unlocked"));

    const replay = { ...firstRun, runId: "case-001:run-2", hintsUsed: 2, attempts: 3, endingId: "case-001-partial" };
    progress.trackerData.stats.casesHistory.push(replay);
    const replayUnlocks = system.checkAll({ caseData, runRecord: replay, ending: { id: replay.endingId } });
    assert.ok(replayUnlocks.some(record => record.id === "two_endings"));

    const saved = system.toJSON();
    const restored = new AchievementSystem(progress, events);
    restored.registerCases([]);
    restored.load(saved);
    assert.deepEqual(Array.from(restored.unlocked).sort(), Array.from(system.unlocked).sort());
    assert.equal(restored.records.case_001_full_truth.runId, "case-001:run-1");
    assert.equal(restored.getSummary().unlocked, system.getSummary().unlocked);
});

test("AchievementSystem rejects malformed case achievement definitions", () => {
    const AchievementSystem = loadClass("assets/js/systems/achievements.js", "AchievementSystem", {
        events: { emit() {} }, CASES_INDEX: {}
    });
    const system = new AchievementSystem({});
    assert.equal(system.register({ id: "broken", name: "Broken" }), false);
    assert.equal(system.register({ id: "valid", name: "Valid", criteria: { type: "case_solved", caseId: "case-x" } }), true);
    assert.equal(system.register({ id: "valid", name: "Updated", criteria: { type: "case_solved", caseId: "case-x" } }), true);
    assert.equal(system.getAll().filter(item => item.id === "valid").length, 1);
});


test("SaveController includes achievement unlock records in the same durable snapshot", () => {
    const snapshots = [];
    const SaveController = loadClass("assets/js/controllers/saveController.js", "SaveController", {});
    const achievementData = {
        version: 1,
        unlocked: ["first_case"],
        records: [{ id: "first_case", unlockedAt: "2026-11-20T10:00:00.000Z", caseId: "case-001", runId: "run-1" }]
    };
    const app = {
        progress: { activeCase: null },
        saveBlocked: false,
        gameTime: { toJSON: () => ({ hour: 8 }) },
        achievementSystem: { toJSON: () => achievementData }
    };
    const storage = {
        saveProgress(snapshot) {
            snapshots.push(JSON.parse(JSON.stringify(snapshot)));
            return true;
        },
        loadProgress: () => null
    };
    const controller = new SaveController(app, storage);

    assert.equal(controller.quickSave(), true);
    assert.deepEqual(snapshots[0].achievementData, achievementData);
    assert.deepEqual(app.progress.achievementData, achievementData);
});


test("AchievementScreen renders progress, hides secret requirements and filters the collection", () => {
    let clickHandler = null;
    let backHandler = null;
    const backButton = { addEventListener: (name, handler) => { if (name === "click") backHandler = handler; } };
    const container = {
        innerHTML: "",
        addEventListener: (name, handler) => { if (name === "click") clickHandler = handler; },
        querySelector: selector => selector === "[data-achievement-back]" ? backButton : null
    };
    const AchievementScreen = loadClass("assets/js/ui/achievementScreen.js", "AchievementScreen", {
        document: { getElementById: id => id === "screen-achievements" ? container : null },
        Intl,
        Date
    });
    const system = {
        records: { unlocked_one: { unlockedAt: "2026-11-20T10:00:00.000Z" } },
        getAll: () => [
            { id: "unlocked_one", name: "Первое дело", description: "Раскройте первое дело", icon: "🔍", rarity: "common", unlocked: true },
            { id: "secret_one", name: "Скрытая разгадка", description: "Секретное условие", icon: "◆", rarity: "epic", secret: true, unlocked: false },
            { id: "locked_one", name: "Опытный сыщик", description: "Три дела", icon: "⭐", rarity: "rare", unlocked: false }
        ],
        getSummary: () => ({ total: 3, unlocked: 1, percent: 33 })
    };
    const screen = new AchievementScreen("screen-achievements", system);
    let returnedToMenu = false;
    screen.setOnBack(() => { returnedToMenu = true; });
    screen.render();
    assert.equal(typeof backHandler, "function");
    backHandler();
    assert.equal(returnedToMenu, true);

    assert.match(container.innerHTML, /data-achievement-count>1<\/span> \/ 3/);
    assert.match(container.innerHTML, /33%/);
    assert.match(container.innerHTML, /Первое дело/);
    assert.match(container.innerHTML, /СЕКРЕТНОЕ ДОСТИЖЕНИЕ/);
    assert.doesNotMatch(container.innerHTML, /Скрытая разгадка|Секретное условие/);
    assert.equal(typeof clickHandler, "function");

    clickHandler({ target: { closest: () => ({ dataset: { achievementFilter: "unlocked" } }) } });
    assert.match(container.innerHTML, /Первое дело/);
    assert.doesNotMatch(container.innerHTML, /Опытный сыщик|СЕКРЕТНОЕ ДОСТИЖЕНИЕ/);

    clickHandler({ target: { closest: () => ({ dataset: { achievementFilter: "secret" } }) } });
    assert.match(container.innerHTML, /СЕКРЕТНОЕ ДОСТИЖЕНИЕ/);
    assert.doesNotMatch(container.innerHTML, /Первое дело/);
});


test("AchievementSystem unlocks night and full-board achievements only from real gameplay events", () => {
    const listeners = new Map();
    const emitted = [];
    const events = {
        on(name, callback) {
            const callbacks = listeners.get(name) || [];
            callbacks.push(callback);
            listeners.set(name, callbacks);
            return () => listeners.set(name, (listeners.get(name) || []).filter(item => item !== callback));
        },
        emit(name, payload) {
            emitted.push({ name, payload });
            for (const callback of listeners.get(name) || []) callback(payload);
        }
    };
    const progress = { activeCase: null, achievementData: null };
    const storage = { set() {} };
    const AchievementSystem = loadClass("assets/js/systems/achievements.js", "AchievementSystem", {
        events, storage, CASES_INDEX: {}
    });
    const system = new AchievementSystem(progress, events);

    events.emit("time:changed", { hour: 2, minute: 10 });
    assert.equal(system.unlocked.includes("night_owl"), false, "time outside an active case must not award the achievement");

    progress.activeCase = "case-001";
    events.emit("time:changed", { hour: 5, minute: 0 });
    assert.equal(system.unlocked.includes("night_owl"), false, "dawn is outside the midnight window");
    events.emit("time:changed", { hour: 2, minute: 10 });
    assert.equal(system.unlocked.includes("night_owl"), true);
    assert.equal(system.records.night_owl.caseId, "case-001");

    events.emit("board:updated", {
        action: "place", caseId: "case-001", filledSlots: 5, totalSlots: 6
    });
    assert.equal(system.unlocked.includes("board_master"), false, "a partially filled board is not complete");
    events.emit("board:updated", {
        action: "place", caseId: "case-001", filledSlots: 6, totalSlots: 6
    });
    assert.equal(system.unlocked.includes("board_master"), true);
    assert.equal(progress.achievementData.unlocked.length, 2);

    system.dispose();
    progress.activeCase = "case-002";
    events.emit("time:changed", { hour: 1, minute: 0 });
    assert.equal(system.records.night_owl.caseId, "case-001", "disposed listeners must not react to future events");
});


test("AchievementSystem awards collector only after every declared case clue is acquired", () => {
    const listeners = new Map();
    const events = {
        on(name, callback) {
            const callbacks = listeners.get(name) || [];
            callbacks.push(callback);
            listeners.set(name, callbacks);
            return () => listeners.set(name, (listeners.get(name) || []).filter(item => item !== callback));
        },
        emit(name, payload) {
            for (const callback of listeners.get(name) || []) callback(payload);
        }
    };
    const progress = { activeCase: null, achievementData: null };
    const inventory = { items: [] };
    const caseData = { id: "case-001", evidenceIds: ["clue-a", "clue-b", "clue-c"] };
    const AchievementSystem = loadClass("assets/js/systems/achievements.js", "AchievementSystem", {
        events, storage: { set() {} }, CASES_INDEX: { "case-001": caseData }
    });
    const system = new AchievementSystem(progress, events, { inventory });

    events.emit("case:started", { caseId: "case-001", caseData });
    inventory.items.push("clue-a", "clue-b");
    events.emit("inventory:changed", { action: "add", itemId: "clue-b" });
    assert.equal(system.unlocked.includes("all_evidence"), false, "missing one clue must keep the achievement locked");

    inventory.items.push("clue-c");
    events.emit("inventory:changed", { action: "add", itemId: "clue-c" });
    assert.equal(system.unlocked.includes("all_evidence"), true);
    assert.equal(system.records.all_evidence.caseId, "case-001");
    events.emit("inventory:changed", { action: "add", itemId: "clue-c" });
    assert.equal(system.unlocked.filter(id => id === "all_evidence").length, 1);
    system.dispose();
});

test("AchievementSystem awards speedy from elapsed in-game minutes, with a strict 30-minute limit", () => {
    const listeners = new Map();
    const events = {
        on(name, callback) {
            const callbacks = listeners.get(name) || [];
            callbacks.push(callback);
            listeners.set(name, callbacks);
            return () => listeners.set(name, (listeners.get(name) || []).filter(item => item !== callback));
        },
        emit(name, payload) {
            for (const callback of listeners.get(name) || []) callback(payload);
        }
    };
    const progress = { activeCase: null, gameTime: { day: 1, hour: 8, minute: 0 } };
    const clock = { value: { day: 1, hour: 8, minute: 0 }, toJSON() { return { ...this.value }; } };
    const AchievementSystem = loadClass("assets/js/systems/achievements.js", "AchievementSystem", {
        events, storage: { set() {} }, CASES_INDEX: {}
    });
    const system = new AchievementSystem(progress, events, { gameTime: clock });

    events.emit("case:started", { caseId: "case-001" });
    assert.equal(progress.activeRunStartedGameMinute, 480);
    clock.value = { day: 1, hour: 8, minute: 29 };
    events.emit("case:solved", { caseId: "case-001" });
    assert.equal(system.unlocked.includes("speedy"), true);
    assert.equal(system.records.speedy.caseId, "case-001");
    assert.equal(progress.activeRunStartedGameMinute, null);

    const exactProgress = { activeCase: null, gameTime: { day: 1, hour: 8, minute: 0 } };
    const exactClock = { value: { day: 1, hour: 8, minute: 0 }, toJSON() { return { ...this.value }; } };
    const exactSystem = new AchievementSystem(exactProgress, events, { gameTime: exactClock });
    events.emit("case:started", { caseId: "case-002" });
    exactClock.value = { day: 1, hour: 8, minute: 30 };
    events.emit("case:solved", { caseId: "case-002" });
    assert.equal(exactSystem.unlocked.includes("speedy"), false, "exactly 30 minutes does not qualify");
    system.dispose();
    exactSystem.dispose();
});


test("AchievementSystem reconciles collected evidence when resuming an active investigation", () => {
    const listeners = new Map();
    const events = {
        on(name, callback) {
            const callbacks = listeners.get(name) || [];
            callbacks.push(callback);
            listeners.set(name, callbacks);
            return () => listeners.set(name, (listeners.get(name) || []).filter(item => item !== callback));
        },
        emit(name, payload) {
            for (const callback of listeners.get(name) || []) callback(payload);
        }
    };
    const progress = { activeCase: "case-002", achievementData: null };
    const inventory = { items: ["clue-a", "clue-b"] };
    const caseData = { id: "case-002", evidenceIds: ["clue-a", "clue-b"] };
    const AchievementSystem = loadClass("assets/js/systems/achievements.js", "AchievementSystem", {
        events, storage: { set() {} }, CASES_INDEX: { "case-002": caseData }
    });
    const system = new AchievementSystem(progress, events, { inventory });
    system.load(null);
    const unlocked = system.reconcile();
    assert.ok(unlocked.some(record => record.id === "all_evidence"));
    assert.equal(system.records.all_evidence.caseId, "case-002");
    system.dispose();
});


test("AchievementSystem awards social detective only after every case participant finishes a dialogue", () => {
    const listeners = new Map();
    const emitted = [];
    const events = {
        on(name, callback) {
            const callbacks = listeners.get(name) || [];
            callbacks.push(callback);
            listeners.set(name, callbacks);
            return () => listeners.set(name, (listeners.get(name) || []).filter(item => item !== callback));
        },
        emit(name, payload) {
            emitted.push({ name, payload });
            for (const callback of listeners.get(name) || []) callback(payload);
        }
    };
    const caseData = { id: "case-001", npcs: ["porter", "bartender", "housekeeper"] };
    const progress = { activeCase: null, activeCaseDialogueNpcIds: [] };
    const AchievementSystem = loadClass("assets/js/systems/achievements.js", "AchievementSystem", {
        events, storage: { set() {} }, CASES_INDEX: { "case-001": caseData }
    });
    const system = new AchievementSystem(progress, events);

    events.emit("case:started", { caseId: "case-001", caseData });
    events.emit("dialogue:completed", { npcId: "porter", dialogueId: "porter_intro" });
    events.emit("dialogue:completed", { npcId: "porter", dialogueId: "porter_intro" });
    events.emit("dialogue:completed", { npcId: "unknown", dialogueId: "unknown_intro" });
    assert.deepEqual(Array.from(progress.activeCaseDialogueNpcIds), ["porter"]);
    assert.equal(system.unlocked.includes("social_detective"), false);

    events.emit("dialogue:completed", { npcId: "bartender", dialogueId: "bartender_intro" });
    assert.equal(system.unlocked.includes("social_detective"), false);
    events.emit("dialogue:completed", { npcId: "housekeeper", dialogueId: "housekeeper_intro" });
    assert.equal(system.unlocked.includes("social_detective"), true);
    assert.equal(system.records.social_detective.caseId, "case-001");
    assert.ok(emitted.some(event => event.name === "achievement:progress_changed"));
    system.dispose();
});
