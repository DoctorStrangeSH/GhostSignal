import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadApp(globals) {
    const context = vm.createContext({ console, ...globals });
    const source = readFileSync(resolve(root, "assets/js/core/app.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__appClass = App;", context);
    return context.__appClass;
}

test("resetting an investigation discards only its run and reloads from a clean snapshot", () => {
    const sequence = [];
    const snapshot = {
        activeCase: "case-002", inventoryData: { items: ["letter"] },
        boardData: { slots: ["letter"] }, npcData: { joe: true },
        notesData: { notes: ["tip"] }, caseData: { caseState: "active" },
        locationData: { currentLocation: "bar" }, chainData: { chains: ["x"] },
        stakeoutData: { active: true }, interrogationData: { complete: true },
        solvedCases: ["case-001"],
        trackerData: { totalCasesSolved: 1 },
        activeRunId: "case-002:active-run",
        activeRunStartedGameMinute: 47,
        activeCaseDialogueNpcIds: ["waiter"],
        dialogueData: { caseId: "case-002", npcId: "waiter", nodeId: "promise" },
        playthroughSequence: 4,
        completedRunIds: ["case-001:completed-run"],
        lastCompletedRunId: "case-001:completed-run",
        achievementData: { version: 1, unlocked: ["first_ending"], records: [{ id: "first_ending" }] },
        reputationData: { score: 42 }
    };
    const memory = {
        currentCaseId: "case-002",
        cases: { "case-001": { joe: { met: true } }, "case-002": { waiter: { met: true } } },
        people: { joe: { trust: 70 } },
        toJSON() { return { currentCaseId: this.currentCaseId, cases: this.cases, people: this.people }; }
    };
    const scoped = () => ({
        currentCaseId: "case-002",
        cases: { "case-001": { known: true }, "case-002": { known: true } },
        resetCase(id) { delete this.cases[id]; },
        toJSON() { return { currentCaseId: this.currentCaseId, cases: this.cases }; }
    });
    const App = loadApp({
        document: { addEventListener() {} },
        location: { reload() { sequence.push("reload"); } }
    });
    const app = Object.create(App.prototype);
    app.progress = snapshot;
    app.npcMemoryService = memory;
    app.npcSocialNetwork = scoped();
    app.npcRelationshipService = scoped();
    const trackerContext = vm.createContext({
        console,
        events: { emit() {} },
        CONFIG: { ranks: [{ name: "Новичок", minSolved: 0 }] }
    });
    vm.runInContext(
        readFileSync(resolve(root, "assets/js/systems/progressTracker.js"), "utf8") +
            "\n;globalThis.__ProgressTracker = ProgressTracker;",
        trackerContext
    );
    app.progressTracker = new trackerContext.__ProgressTracker();
    app.progressTracker.stats.casesHistory = [{
        runId: "case-001:completed-run", caseId: "case-001", result: "solved",
        endingId: "case-001-perfect"
    }];
    app.progressTracker.stats.totalCasesSolved = 1;
    app.progressTracker.stats.solvedCaseIds = ["case-001"];
    app.progressTracker.startCase("case-002", "case-002:active-run");
    app.progressTracker.useHint();
    app.progressTracker.addAttempt();
    app.eventController = { dispose() { sequence.push("dispose"); } };
    app._saveProgress = () => {
        sequence.push("save");
        assert.equal(snapshot.activeCase, null);
        assert.equal(snapshot.inventoryData, null);
        assert.equal(snapshot.npcMemoryData.cases["case-002"], undefined);
        assert.equal(snapshot.dialogueData, null);
        assert.equal(snapshot.activeRunId, null);
        assert.equal(snapshot.activeRunStartedGameMinute, null);
        assert.deepEqual(Array.from(snapshot.activeCaseDialogueNpcIds), []);
        assert.equal(snapshot.trackerData.activeRunId, null);
        assert.equal(snapshot.trackerData.activeCaseId, null);
    };

    assert.equal(app._resetCurrentCase(), true);
    assert.deepEqual(sequence, ["dispose", "save", "reload"]);
    assert.equal(snapshot.boardData, null);
    assert.equal(snapshot.chainData, null);
    assert.equal(snapshot.interrogationData, null);
    assert.equal(snapshot.dialogueData, null);
    assert.equal(snapshot.activeRunId, null);
    assert.equal(snapshot.activeRunStartedGameMinute, null);
    assert.deepEqual(snapshot.activeCaseDialogueNpcIds, []);
    assert.equal(snapshot.playthroughSequence, 4);
    assert.deepEqual(snapshot.completedRunIds, ["case-001:completed-run"]);
    assert.equal(snapshot.lastCompletedRunId, "case-001:completed-run");
    assert.deepEqual(snapshot.achievementData, {
        version: 1, unlocked: ["first_ending"], records: [{ id: "first_ending" }]
    });
    assert.deepEqual(snapshot.reputationData, { score: 42 });
    assert.deepEqual(snapshot.solvedCases, ["case-001"]);
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot.trackerData.stats.casesHistory)), [{
        runId: "case-001:completed-run", caseId: "case-001", result: "solved",
        endingId: "case-001-perfect"
    }]);
    assert.equal(snapshot.trackerData.stats.totalCasesSolved, 1);
    assert.equal(snapshot.trackerData.stats.totalHintsUsed, 1);
    assert.equal(snapshot.trackerData.stats.totalAttempts, 1);
    assert.equal(snapshot.trackerData.caseStartTime, null);
    assert.equal(snapshot.trackerData.caseHintsUsed, 0);
    assert.equal(snapshot.trackerData.caseAttempts, 0);
    assert.deepEqual(snapshot.npcMemoryData.cases["case-001"], { joe: { met: true } });
    assert.deepEqual(snapshot.npcMemoryData.people, { joe: { trust: 70 } });
    assert.ok(snapshot.npcSocialData.cases["case-001"]);
    assert.ok(snapshot.npcRelationshipData.cases["case-001"]);
    assert.equal(snapshot.npcSocialData.cases["case-002"], undefined);
    assert.equal(snapshot.npcRelationshipData.cases["case-002"], undefined);
});

test("resetting without an active case does not erase any saved data", () => {
    const App = loadApp({ document: { addEventListener() {} } });
    const app = Object.create(App.prototype);
    app.progress = { activeCase: null, solvedCases: ["case-001"] };
    app._saveProgress = () => { throw Error("No save expected"); };
    assert.equal(app._resetCurrentCase(), false);
    assert.deepEqual(app.progress.solvedCases, ["case-001"]);
});
