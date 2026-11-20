import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "assets/js/npc/npcManager.js"), "utf8");

function createManager() {
    const npc = {
        id: "bartender",
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
    const context = vm.createContext({
        console,
        events: { emit() {} },
        getNPCById: id => id === "bartender" ? npc : null,
        getCaseById: id => cases[id] || null
    });
    vm.runInContext(source + "\n;globalThis.__NPCManager = NPCManager;", context);
    return new context.__NPCManager({}, {});
}

test("NPC dialogue overrides are resolved by the active case pack", () => {
    const manager = createManager();

    manager.currentCaseId = "case-001";
    assert.equal(manager.getDialogueForNPC("bartender"), "dialogue-bartender");

    manager.currentCaseId = "case-002";
    assert.equal(manager.getDialogueForNPC("bartender"), "dialogue-bartender-case2");

    manager.currentCaseId = null;
    assert.equal(manager.getDialogueForNPC("bartender"), "dialogue-bartender");
});

test("case-specific dialogue override does not change the shared NPC profile", () => {
    const manager = createManager();

    manager.currentCaseId = "case-002";
    assert.equal(manager.getDialogueForNPC("bartender"), "dialogue-bartender-case2");

    manager.currentCaseId = "case-001";
    assert.equal(manager.getDialogueForNPC("bartender"), "dialogue-bartender");
});
