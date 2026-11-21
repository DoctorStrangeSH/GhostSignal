import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const context = vm.createContext({
    console,
    events: { emit() {} },
    CONFIG: { ranks: [{ name: "Новичок", minSolved: 0 }] }
});
vm.runInContext(readFileSync(resolve(root, "assets/js/systems/progressTracker.js"), "utf8"), context);
const ProgressTracker = vm.runInContext("ProgressTracker", context);

test("failed runs are persisted independently and do not count as solved cases", () => {
    const tracker = new ProgressTracker();
    const caseData = { id: "case-001", title: "Исчезновение Блэквуда" };
    tracker.startCase(caseData.id, "case-001:failed-run-1");
    const failed = tracker.caseFailed(caseData);

    assert.equal(failed.result, "failed");
    assert.equal(tracker.stats.totalCasesFailed, 1);
    assert.equal(tracker.stats.totalCasesSolved, 0);
    assert.equal(tracker.stats.totalSolvedRuns, 0);
    assert.equal(tracker.stats.solvedCaseIds.length, 0);
    assert.equal(tracker.stats.casesHistory.length, 1);
});

test("repeated failure callbacks for one run do not duplicate history or counters", () => {
    const tracker = new ProgressTracker();
    const caseData = { id: "case-001", title: "Исчезновение Блэквуда" };
    tracker.startCase(caseData.id, "case-001:failed-run-2");
    const first = tracker.caseFailed(caseData, "case-001:failed-run-2");
    const second = tracker.caseFailed(caseData, "case-001:failed-run-2");

    assert.equal(second, first);
    assert.equal(tracker.stats.totalCasesFailed, 1);
    assert.equal(tracker.stats.casesHistory.length, 1);
});

test("save and restore preserve mixed failed and solved runs for replay history", () => {
    const tracker = new ProgressTracker();
    const caseData = { id: "case-001", title: "Исчезновение Блэквуда" };
    tracker.startCase(caseData.id, "case-001:failed-run-3");
    tracker.caseFailed(caseData);
    tracker.startCase(caseData.id, "case-001:solved-run-1");
    tracker.caseSolved(caseData, undefined, { id: "case-001-partial", title: "Частичное раскрытие" });

    const restored = ProgressTracker.fromJSON(JSON.parse(JSON.stringify(tracker.toJSON())));
    assert.deepEqual(restored.stats.casesHistory.map(record => [record.result, record.endingId]), [
        ["failed", undefined],
        ["solved", "case-001-partial"]
    ]);
    assert.equal(restored.stats.totalCasesFailed, 1);
    assert.equal(restored.stats.totalCasesSolved, 1);
    assert.equal(restored.stats.totalSolvedRuns, 1);
    assert.deepEqual(Array.from(restored.stats.solvedCaseIds), ["case-001"]);
});

test("solving a case on replay increments solved runs but counts the unique case only once", () => {
    const tracker = new ProgressTracker();
    const caseData = { id: "case-001", title: "Исчезновение Блэквуда" };
    tracker.startCase(caseData.id, "case-001:partial");
    tracker.caseSolved(caseData, undefined, { id: "case-001-partial" });
    tracker.startCase(caseData.id, "case-001:perfect");
    tracker.caseSolved(caseData, undefined, { id: "case-001-perfect" });

    assert.equal(tracker.stats.totalSolvedRuns, 2);
    assert.equal(tracker.stats.totalCasesSolved, 1);
    assert.deepEqual(Array.from(tracker.stats.solvedCaseIds), ["case-001"]);
    assert.deepEqual(tracker.stats.casesHistory.map(record => record.endingId), [
        "case-001-partial", "case-001-perfect"
    ]);
});
