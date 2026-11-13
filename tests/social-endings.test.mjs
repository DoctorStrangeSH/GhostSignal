import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadSystems() {
    const endings = {
        perfect: {
            id: "perfect", caseId: "case-002", condition: "full_confession_kane", title: "Идеально", text: "Базовая концовка.",
            socialConsequences: { waiter: { promiseFulfilled: "Томасу помогли.", promiseBroken: "Томасу не помогли.", lowTrustThreshold: 35, lowTrust: "Томас больше не доверяет детективу." } }
        },
        partial: {
            id: "partial", caseId: "case-002", condition: "evidence_count_4", title: "Частично", text: "Частичная концовка.",
            socialConsequences: { waiter: { promiseBroken: "Обещание Томасу нарушено." } }
        }
    };
    const context = vm.createContext({ console, window: { ENDINGS: endings } });
    for (const path of ["assets/js/npc/npcMemoryService.js", "assets/js/systems/alternateEndings.js"]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }
    return vm.runInContext(`(() => ({
        memory: new NPCMemoryService(null, "case-002"),
        endings: new AlternateEndings()
    }))()`, context);
}

test("Perfect ending reflects a fulfilled promise to an NPC", () => {
    const { memory, endings } = loadSystems();
    memory.recordPromise("waiter", {
        id: "protect-family", text: "Защитить семью Томаса",
        fulfillment: { type: "insight_gained", insightId: "full_confession_kane" }
    });
    memory.resolvePromisesForEvent({ type: "insight_gained", insightId: "full_confession_kane" });
    const ending = endings.determineEnding(
        { id: "case-002" },
        { hasInsight: id => id === "full_confession_kane" },
        6,
        { npcMemoryService: memory }
    );
    assert.equal(ending.id, "perfect");
    assert.match(ending.text, /Базовая концовка/);
    assert.match(ending.text, /Томасу помогли/);
    assert.equal(ending.socialConsequencesApplied, 1);
});

test("Partial ending reflects a broken promise without changing the legal outcome", () => {
    const { memory, endings } = loadSystems();
    memory.recordPromise("waiter", {
        id: "protect-family", text: "Защитить семью Томаса",
        fulfillment: { type: "insight_gained", insightId: "full_confession_kane" }
    });
    memory.settlePromisesForCase("case-002", "solved");
    const ending = endings.determineEnding(
        { id: "case-002" },
        { hasInsight: () => false, items: ["a", "b", "c", "d"] },
        4,
        { npcMemoryService: memory }
    );
    assert.equal(ending.id, "partial");
    assert.match(ending.text, /Обещание Томасу нарушено/);
    assert.equal(ending.socialConsequencesApplied, 1);
});
