import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = [
    'assets/js/npc/npcMemoryService.js',
    'assets/js/npc/npcSocialNetwork.js',
    'assets/js/npc/npcRelationshipService.js',
    'assets/js/systems/board.js',
    'assets/js/controllers/saveController.js'
];

function loadSystems() {
    const context = vm.createContext({
        console,
        events: { emit() {} },
        getObjectById() { return null; }
    });
    for (const path of scripts) {
        vm.runInContext(readFileSync(resolve(root, path), 'utf8'), context, { filename: path });
    }
    return vm.runInContext('({ NPCMemoryService, NPCSocialNetwork, NPCRelationshipService, InvestigationBoard, SaveController })', context);
}

const clone = value => JSON.parse(JSON.stringify(value));

test('investigation NPC claims, rumors, relationships and hypotheses survive a save/reload cycle', () => {
    const { NPCMemoryService, NPCSocialNetwork, NPCRelationshipService, InvestigationBoard, SaveController } = loadSystems();
    const memory = new NPCMemoryService(null, 'case-002');
    const claim = memory.recordClaim('waiter', {
        id: 'thomas-window', topic: 'suspect-route', value: 'North exit',
        summary: 'Thomas saw someone use the north exit', directObservation: true
    });
    assert.equal(claim.added, true);

    const transmission = {
        fromNpcId: 'joe', originalSourceNpcId: 'joe',
        sourceEvent: { dialogueId: 'joe-call', nodeId: 'warning', answerText: 'Watch the exit' },
        path: ['joe', 'waiter'], hops: 1, channel: 'call'
    };
    const report = { id: 'rumor-exit', kind: 'detective_behavior', text: 'The detective asked about the exit' };
    assert.equal(memory.receiveSocialRumor('waiter', report, transmission).received, true);

    const social = new NPCSocialNetwork({
        currentCaseId: 'case-002',
        cases: { 'case-002': { pendingDeliveries: [{ id: 'delivery-1', rumorId: 'rumor-exit' }] } }
    }, memory);
    const relationships = new NPCRelationshipService({
        currentCaseId: 'case-002',
        cases: { 'case-002': { journal: [{ type: 'interview', npcId: 'waiter' }] } },
        worldTrusts: { joe: { waiter: 73 } },
        worldGoals: { waiter: { ambition: 'protect-family' } }
    }, memory, null, null, social);

    const board = new InvestigationBoard();
    board.setCase('case-002');
    const hypothesisId = board.addHypothesis('The witness mistook the exit');
    assert.equal(board.linkHypothesis(hypothesisId, 'statement', 'thomas-window', 'against'), true);

    const progress = { activeCase: 'case-002' };
    let stored = null;
    const storage = { saveProgress(value) { stored = clone(value); return true; } };
    const controller = new SaveController({ progress, npcMemoryService: memory, npcSocialNetwork: social,
        npcRelationshipService: relationships, investigationBoard: board }, storage);
    assert.equal(controller.quickSave(), true);

    const reloaded = clone(stored);
    const restoredMemory = NPCMemoryService.fromJSON(reloaded.npcMemoryData, reloaded.activeCase);
    const restoredSocial = NPCSocialNetwork.fromJSON(reloaded.npcSocialData, restoredMemory);
    const restoredRelationships = NPCRelationshipService.fromJSON(
        reloaded.npcRelationshipData, restoredMemory, null, null, restoredSocial
    );
    const restoredBoard = InvestigationBoard.fromJSON(reloaded.boardData);
    restoredBoard.setCase(reloaded.activeCase, true);

    assert.deepEqual(clone(restoredMemory.toJSON()), clone(memory.toJSON()));
    assert.deepEqual(clone(restoredSocial.toJSON()), clone(social.toJSON()));
    assert.deepEqual(clone(restoredRelationships.toJSON()), clone(relationships.toJSON()));
    assert.deepEqual(clone(restoredBoard.toJSON()), clone(board.toJSON()));

    assert.equal(restoredMemory.getRumors('waiter').length, 1);
    assert.equal(restoredMemory.receiveSocialRumor('waiter', report, transmission).reason, 'already_received');
    assert.equal(restoredBoard.hypotheses[0].links[0].sourceId, 'thomas-window');
    assert.equal(restoredRelationships.worldTrusts.joe.waiter, 73);
});

test('a promise stays pending after reload, then resolves only once when evidence arrives', () => {
    const { NPCMemoryService, SaveController } = loadSystems();
    const memory = new NPCMemoryService(null, 'case-002');
    const promise = {
        id: 'protect-family', text: 'I will make your family safe',
        fulfillment: { type: 'insight_gained', insightId: 'family_protected' },
        fulfilledTrustDelta: 7, brokenTrustDelta: -9
    };
    assert.equal(memory.recordPromise('waiter', promise).recorded, true);
    let saved;
    const app = { progress: { activeCase: 'case-002' }, npcMemoryService: memory };
    const controller = new SaveController(app, { saveProgress(value) { saved = clone(value); return true; } });
    assert.equal(controller.quickSave(), true);

    const restored = NPCMemoryService.fromJSON(saved.npcMemoryData, saved.activeCase);
    assert.equal(restored.getPromises('waiter')[0].status, 'pending');
    assert.equal(restored.recordPromise('waiter', promise).reason, 'already_recorded');
    const trustBefore = restored.getMemory('waiter').trust;
    assert.equal(restored.resolvePromisesForEvent({ type: 'insight_gained', insightId: 'wrong_insight' }).length, 0);
    assert.equal(restored.resolvePromisesForEvent({ type: 'insight_gained', insightId: 'family_protected' }).length, 1);
    assert.equal(restored.getMemory('waiter').trust, trustBefore + 7);

    const completed = NPCMemoryService.fromJSON(clone(restored.toJSON()), 'case-002');
    assert.equal(completed.getPromises('waiter')[0].status, 'fulfilled');
    assert.equal(completed.resolvePromisesForEvent({ type: 'insight_gained', insightId: 'family_protected' }).length, 0);
    assert.equal(completed.settlePromisesForCase('case-002', 'solved').length, 0);
    assert.equal(completed.getMemory('waiter').trust, trustBefore + 7);
});

test('breaking a promise persists its consequence across reloads without double penalty', () => {
    const { NPCMemoryService } = loadSystems();
    const memory = new NPCMemoryService(null, 'case-002');
    assert.equal(memory.recordPromise('waiter', {
        id: 'bring-evidence', text: 'I will bring you evidence',
        fulfillment: { type: 'item_acquired', itemId: 'sealed_letter' },
        brokenTrustDelta: -8
    }).recorded, true);
    const before = memory.getMemory('waiter').trust;
    assert.equal(memory.settlePromisesForCase('case-002', 'failed').length, 1);
    const restored = NPCMemoryService.fromJSON(clone(memory.toJSON()), 'case-002');
    assert.equal(restored.getPromises('waiter')[0].status, 'broken');
    assert.equal(restored.getMemory('waiter').trust, before - 8);
    assert.equal(restored.settlePromisesForCase('case-002', 'failed').length, 0);
    assert.equal(restored.getMemory('waiter').trust, before - 8);
    assert.ok(restored.people.waiter.memories.some(entry => entry.type === 'promise_broken'));
});


function loadCoreSystems() {
    const cases = {
        "case-001": { id: "case-001", title: "Дело 001", npcs: ["bartender"], unlockConditions: [] },
        "case-002": { id: "case-002", title: "Дело 002", npcs: ["waiter"], unlockConditions: [] }
    };
    const npcs = {
        bartender: { id: "bartender", name: "Бармен" },
        waiter: { id: "waiter", name: "Официант" }
    };
    const context = vm.createContext({
        console,
        events: { emit() {} },
        CONFIG: { time: { dawn: 6, day: 9, dusk: 18, night: 22 } },
        getCaseById: id => cases[id] || null,
        getNPCById: id => npcs[id] || null,
        getObjectById: () => null,
        getObjectsByIds: () => [],
        getLocationById: () => null,
        getMapLocations: () => [],
        getSubLocations: () => [],
        window: {}
    });
    const paths = [
        "assets/js/systems/gameTime.js",
        "assets/js/systems/locationManager.js",
        "assets/js/systems/inventory.js",
        "assets/js/systems/caseManager.js",
        "assets/js/npc/npcManager.js",
        "assets/js/systems/notes.js",
        "assets/js/systems/board.js",
        "assets/js/controllers/saveController.js"
    ];
    for (const path of paths) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }
    return vm.runInContext(
        "({ GameTime, LocationManager, Inventory, CaseManager, NPCManager, NotesManager, InvestigationBoard, SaveController })",
        context
    );
}

test("a complete active investigation restores time, map, inventory, case progress, NPC state, notes and board", () => {
    const { GameTime, LocationManager, Inventory, CaseManager, NPCManager, NotesManager, InvestigationBoard, SaveController } = loadCoreSystems();
    const time = new GameTime(21, 35, 4);
    const locations = new LocationManager(time);
    locations.currentLocation = "hotel_room_304";
    locations.unlockedLocations.add("private_archive");
    locations.visitedLocations.add("hotel_room_304");

    const inventory = new Inventory();
    inventory.items = ["magnifying_glass", "sealed_letter"];
    inventory.evidence = ["torn_photo", "telephone_exchange_slip"];
    inventory.insights = ["photo_detail"];
    inventory.currentWeight = 4;

    const caseManager = new CaseManager(time, locations, inventory);
    assert.equal(caseManager.loadCase("case-002"), true);
    caseManager.caseState = "active";
    caseManager.completedEvents = ["joe_interview", "archive_unlocked"];
    caseManager.visitedLocations = ["bar_joe", "hotel_room_304"];
    caseManager.evidenceFound = 7;

    const npcManager = new NPCManager(time, inventory);
    npcManager.currentCaseId = "case-002";
    npcManager.activeNPCs = [{ id: "waiter", name: "Официант" }];
    npcManager.npcStates.waiter = {
        dialoguesCompleted: ["waiter_first_interview"],
        evidenceGiven: ["torn_photo"],
        insightsGiven: ["photo_detail"],
        lastInteraction: { hour: 21, minute: 10 }
    };
    npcManager.autoTriggered = ["waiter_warning"];

    const notes = new NotesManager();
    notes.collectedNotes = ["case-002-police-report"];
    notes.highlightedFragments = [{ id: "fragment-1", noteId: "case-002-police-report", text: "Свидетель изменил время" }];

    const board = new InvestigationBoard();
    board.setCase("case-002");
    const hypothesis = board.addHypothesis("Свидетель изменил время");
    board.linkHypothesis(hypothesis, "evidence", "torn_photo", "against");

    const app = {
        progress: { activeCase: "case-002" },
        gameTime: time, locationManager: locations, inventory, caseManager,
        npcManager, notesManager: notes, investigationBoard: board
    };
    let stored = null;
    const save = new SaveController(app, { saveProgress(value) { stored = clone(value); return true; } });
    assert.equal(save.quickSave(), true);

    const snapshot = clone(stored);
    const restoredTime = GameTime.fromJSON(snapshot.gameTime);
    const restoredLocations = LocationManager.fromJSON(snapshot.locationData, restoredTime);
    const restoredInventory = Inventory.fromJSON(snapshot.inventoryData);
    const restoredCase = CaseManager.fromJSON(snapshot.caseData, restoredTime, restoredLocations, restoredInventory, snapshot.activeCase);
    const restoredNPCs = NPCManager.fromJSON(snapshot.npcData, restoredTime, restoredInventory, snapshot.activeCase);
    const restoredNotes = NotesManager.fromJSON(snapshot.notesData);
    const restoredBoard = InvestigationBoard.fromJSON(snapshot.boardData);
    restoredBoard.setCase(snapshot.activeCase, true);

    assert.deepEqual(clone(restoredTime.toJSON()), clone(time.toJSON()));
    assert.deepEqual(clone(restoredLocations.toJSON()), clone(locations.toJSON()));
    assert.deepEqual(clone(restoredInventory.toJSON()), clone(inventory.toJSON()));
    assert.deepEqual(clone(restoredCase.toJSON()), clone(caseManager.toJSON()));
    assert.deepEqual(clone(restoredNPCs.toJSON()), clone(npcManager.toJSON()));
    assert.deepEqual(clone(restoredNotes.toJSON()), clone(notes.toJSON()));
    assert.deepEqual(clone(restoredBoard.toJSON()), clone(board.toJSON()));
    assert.equal(restoredLocations.activeCaseData.id, "case-002");
    assert.equal(restoredNPCs.activeNPCs[0].id, "waiter");
    assert.equal(restoredCase.canAccuse?.() ?? true, true);
});

test("loading a different active case never imports the previous case's progress or NPC state", () => {
    const { GameTime, LocationManager, Inventory, CaseManager, NPCManager } = loadCoreSystems();
    const time = new GameTime(12, 0, 1);
    const locations = new LocationManager(time);
    const inventory = new Inventory();

    const oldCaseSnapshot = {
        currentCaseId: "case-001",
        caseState: "solved",
        completedEvents: ["old_case_finale"],
        visitedLocations: ["hotel_room_304"],
        evidenceFound: 99
    };
    const restoredCase = CaseManager.fromJSON(oldCaseSnapshot, time, locations, inventory, "case-002");
    assert.equal(restoredCase.currentCase.id, "case-002");
    assert.equal(restoredCase.caseState, "active");
    assert.deepEqual(clone(restoredCase.completedEvents), []);
    assert.deepEqual(clone(restoredCase.visitedLocations), []);
    assert.equal(restoredCase.evidenceFound, 0);

    const oldNpcSnapshot = {
        currentCaseId: "case-001",
        activeNPCs: ["bartender"],
        npcStates: { bartender: { dialoguesCompleted: ["old_confession"] } },
        autoTriggered: ["old_case_trigger"]
    };
    const restoredNPCs = NPCManager.fromJSON(oldNpcSnapshot, time, inventory, "case-002");
    assert.equal(restoredNPCs.currentCaseId, "case-002");
    assert.deepEqual(clone(restoredNPCs.activeNPCs.map(npc => npc.id)), ["waiter"]);
    assert.deepEqual(clone(restoredNPCs.npcStates.waiter.dialoguesCompleted), []);
    assert.deepEqual(clone(restoredNPCs.autoTriggered), []);
});
