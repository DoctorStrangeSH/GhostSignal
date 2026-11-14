import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function createCaseList() {
    const container = {
        innerHTML: "",
        querySelectorAll() { return []; }
    };
    const context = vm.createContext({
        console,
        document: { getElementById(id) { return id === "cases-list" ? container : null; } },
        getAllCases() { return [{ id: "case-001", title: "Отель Гранд", description: "Дело", difficulty: 1 }]; },
        events: { emit() {} }
    });
    vm.runInContext(readFileSync(resolve(root, "assets/js/ui/caseListUI.js"), "utf8") +
        "\n;globalThis.CaseListUIForTest = CaseListUI;", context);
    return { ui: new context.CaseListUIForTest("cases-list"), container };
}

test("case cards refuse to label a failed or stale save as resumable", () => {
    const { ui, container } = createCaseList();
    const progress = {
        activeCase: "case-001",
        solvedCases: [],
        caseData: { currentCaseId: "case-001", caseState: "failed" }
    };
    ui.setProgress(progress);
    assert.match(container.innerHTML, /НАЧАТЬ/);
    assert.doesNotMatch(container.innerHTML, /ПРОДОЛЖИТЬ|В ПРОЦЕССЕ/);

    progress.caseData.caseState = "active";
    ui.setProgress(progress);
    assert.match(container.innerHTML, /ПРОДОЛЖИТЬ/);
    assert.match(container.innerHTML, /В ПРОЦЕССЕ/);

    progress.caseData.currentCaseId = "case-002";
    ui.setProgress(progress);
    assert.doesNotMatch(container.innerHTML, /ПРОДОЛЖИТЬ/);
});

test("case cards reuse CaseController checker across subsequent progress renders", () => {
    const { ui, container } = createCaseList();
    const progress = { activeCase: "case-001", solvedCases: [], caseData: null };
    let active = true;
    ui.setProgress(progress, id => active && id === "case-001");
    assert.match(container.innerHTML, /ПРОДОЛЖИТЬ/);

    active = false;
    ui.setProgress(progress);
    assert.match(container.innerHTML, /НАЧАТЬ/);
    assert.doesNotMatch(container.innerHTML, /В ПРОЦЕССЕ/);
});
