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
        solvedCases: ["case-001"], trackerData: { totalCasesSolved: 1 }
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
    app.eventController = { dispose() { sequence.push("dispose"); } };
    app._saveProgress = () => {
        sequence.push("save");
        assert.equal(snapshot.activeCase, null);
        assert.equal(snapshot.inventoryData, null);
        assert.equal(snapshot.npcMemoryData.cases["case-002"], undefined);
    };

    assert.equal(app._resetCurrentCase(), true);
    assert.deepEqual(sequence, ["dispose", "save", "reload"]);
    assert.equal(snapshot.boardData, null);
    assert.equal(snapshot.chainData, null);
    assert.equal(snapshot.interrogationData, null);
    assert.deepEqual(snapshot.solvedCases, ["case-001"]);
    assert.deepEqual(snapshot.trackerData, { totalCasesSolved: 1 });
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
