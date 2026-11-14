import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadCaseController(globals = {}) {
    const context = vm.createContext({ console, ...globals });
    const source = readFileSync(resolve(root, "assets/js/controllers/caseController.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__exported = CaseController;", context);
    return context.__exported;
}

function createHarness(overrides = {}) {
    const calls = [];
    const elements = {
        "header-case-id": { textContent: "" },
        "header-case-title": { textContent: "" }
    };
    const app = {
        progress: { activeCase: null },
        caseManager: {
            currentCase: null,
            caseState: null,
            loadCase(id) {
                calls.push(["loadCase", id]);
                if (overrides.loadResult === false) return false;
                this.currentCase = { id };
                this.caseState = "active";
                return true;
            }
        },
        locationManager: { currentLocation: null },
        sceneRenderer: { renderLocation(id) { calls.push(["renderLocation", id]); } },
        navigateTo(id) { calls.push(["navigateTo", id]); },
        _quickSave() { calls.push(["save"]); }
    };
    Object.assign(app, overrides.app || {});
    const document = { getElementById(id) { return elements[id] || null; } };
    const lookup = overrides.lookup || (id => id === "case-001"
        ? { id, title: "The Hotel Room", startLocation: "hotel_room_304" }
        : null);
    const CaseController = loadCaseController({ document, console });
    return { controller: new CaseController(app, lookup), app, calls, elements };
}

test("CaseController starts a known case, renders its start location and persists selection", () => {
    const { controller, app, calls, elements } = createHarness();

    assert.equal(controller.loadCase("case-001"), true);
    assert.deepEqual(calls, [
        ["loadCase", "case-001"],
        ["navigateTo", "screen-case-active"],
        ["renderLocation", "hotel_room_304"],
        ["save"]
    ]);
    assert.equal(app.progress.activeCase, "case-001");
    assert.equal(elements["header-case-id"].textContent, "001");
    assert.equal(elements["header-case-title"].textContent, "The Hotel Room");
});

test("CaseController resumes the active case without resetting CaseManager state", () => {
    const { controller, app, calls } = createHarness({
        app: {
            progress: { activeCase: "case-001" },
            caseManager: {
                currentCase: { id: "case-001" },
                caseState: "active",
                loadCase() { throw new Error("resuming must not reset the case"); }
            },
            locationManager: { currentLocation: "bar_joe" }
        }
    });

    assert.equal(controller.loadCase("case-001"), true);
    assert.deepEqual(calls, [
        ["navigateTo", "screen-case-active"],
        ["renderLocation", "bar_joe"],
        ["save"]
    ]);
});

test("CaseController saves the selected case and existing evidence in one snapshot", () => {
    const snapshots = [];
    const app = {
        progress: { activeCase: null },
        caseManager: {
            currentCase: null,
            caseState: null,
            loadCase(id) { this.currentCase = { id }; this.caseState = "active"; return true; }
        },
        locationManager: { currentLocation: "police_station" },
        investigationBoard: { toJSON: () => ({ evidenceSlots: ["letter"] }) },
        navigateTo() {},
        _quickSave() {
            snapshots.push({
                activeCase: this.progress.activeCase,
                boardData: this.investigationBoard.toJSON()
            });
            return true;
        }
    };
    const CaseController = loadCaseController({ document: { getElementById: () => null } });
    const controller = new CaseController(app, id => ({ id, title: "The Hotel Room" }));

    assert.equal(controller.loadCase("case-001"), true);
    assert.deepEqual(snapshots, [{ activeCase: "case-001", boardData: { evidenceSlots: ["letter"] } }]);
});

test("CaseController refuses unknown cases without navigating or saving", () => {
    const { controller, calls, app } = createHarness();

    assert.equal(controller.loadCase("case-999"), false);
    assert.deepEqual(calls, []);
    assert.equal(app.progress.activeCase, null);
});

test("CaseController stays on the current screen when CaseManager rejects a case", () => {
    const { controller, calls, app } = createHarness({ loadResult: false });

    assert.equal(controller.loadCase("case-001"), false);
    assert.deepEqual(calls, [["loadCase", "case-001"]]);
    assert.equal(app.progress.activeCase, null);
});

test("CaseController safely refuses to run before app progress and CaseManager are ready", () => {
    const { controller, calls } = createHarness({
        app: { progress: null, caseManager: null }
    });

    assert.equal(controller.loadCase("case-001"), false);
    assert.deepEqual(calls, []);
});

test("Continue is available only for a matching active case", () => {
    const { controller, app } = createHarness();
    app.progress.activeCase = "case-001";
    app.caseManager.currentCase = { id: "case-001" };
    app.caseManager.caseState = "active";
    assert.equal(controller.canResume(), true);
    assert.equal(controller.canResume("case-999"), false);

    for (const state of ["failed", "solved", null]) {
        app.caseManager.caseState = state;
        assert.equal(controller.canResume(), false, "closed case: " + state);
    }
    app.caseManager.caseState = "active";
    app.caseManager.currentCase = { id: "case-002" };
    assert.equal(controller.canResume(), false, "different case cannot be resumed");
    app.progress.activeCase = null;
    assert.equal(controller.canResume(), false, "missing active case cannot be resumed");
});

test("new playthrough clears run-only systems without replacing shared objects", () => {
    const { controller, app } = createHarness();
    const inventory = { items: ["old-key"], evidence: ["old-key"], insights: ["old-theory"], currentWeight: 3 };
    const notes = { collectedNotes: ["old-note"], highlightedFragments: ["old"], activeNote: "old-note" };
    const stakeout = { activeStakeouts: ["old"], completedStakeouts: ["old"] };
    const interrogation = { activeNPC: "waiter", patience: 4, questionsAsked: 3, npcGone: { waiter: true }, backupPaths: { clue: true } };
    const chains = { chains: ["old"], completedChains: ["old"], currentCaseId: "case-001" };
    Object.assign(app, {
        inventory, notesManager: notes, stakeoutSystem: stakeout,
        interrogationSystem: interrogation, evidenceChainSystem: chains
    });

    assert.equal(controller.loadCase("case-001"), true);
    assert.equal(app.inventory, inventory);
    assert.equal(inventory.items.length, 0);
    assert.equal(inventory.evidence.length, 0);
    assert.equal(inventory.insights.length, 0);
    assert.equal(inventory.currentWeight, 0);
    assert.equal(notes.collectedNotes.length, 0);
    assert.equal(notes.highlightedFragments.length, 0);
    assert.equal(notes.activeNote, null);
    assert.equal(stakeout.activeStakeouts.length, 0);
    assert.equal(stakeout.completedStakeouts.length, 0);
    assert.equal(Object.keys(interrogation.npcGone).length, 0);
    assert.equal(Object.keys(interrogation.backupPaths).length, 0);
    assert.equal(chains.completedChains.length, 0);
    assert.equal(chains.currentCaseId, null);
});

test("resuming a live investigation preserves inventory, notes and interrogation", () => {
    const { controller, app } = createHarness();
    app.progress.activeCase = "case-001";
    app.caseManager.currentCase = { id: "case-001" };
    app.caseManager.caseState = "active";
    const inventory = { items: ["case-key"], evidence: ["case-key"], insights: [], currentWeight: 2 };
    app.inventory = inventory;
    app.notesManager = { collectedNotes: ["case-note"] };
    app.interrogationSystem = { npcGone: { waiter: true } };

    assert.equal(controller.loadCase("case-001"), true);
    assert.deepEqual(inventory.items, ["case-key"]);
    assert.deepEqual(app.notesManager.collectedNotes, ["case-note"]);
    assert.equal(app.interrogationSystem.npcGone.waiter, true);
});
