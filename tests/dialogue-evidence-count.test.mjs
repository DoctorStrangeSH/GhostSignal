import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "assets/js/npc/dialogueEngine.js"), "utf8");

const objects = {
    guest_book: { isEvidence: true },
    wire_fragment: { isEvidence: true },
    hidden_note: { isEvidence: true },
    magnifying_glass: { isEvidence: false }
};

function createEngine(inventory) {
    const context = vm.createContext({
        getObjectById: id => objects[id] || null
    });
    vm.runInContext(`${source}\nglobalThis.DialogueEngineForTest = DialogueEngine;`, context);
    return new context.DialogueEngineForTest(inventory, null);
}

test("warrant evidence threshold counts collected evidence already placed on the board", () => {
    const engine = createEngine({
        items: ["guest_book", "wire_fragment", "hidden_note"],
        // Two clues are on the board and only one remains in the tray.
        evidence: ["hidden_note"]
    });

    assert.equal(engine._checkCondition("evidence_count:3"), true);
});

test("warrant evidence threshold ignores tools and duplicate identifiers", () => {
    const engine = createEngine({
        items: ["guest_book", "wire_fragment", "magnifying_glass", "guest_book"],
        evidence: ["guest_book", "wire_fragment"]
    });

    assert.equal(engine._checkCondition("evidence_count:3"), false);
    assert.equal(engine._checkCondition("evidence_count:2"), true);
});

test("warrant evidence threshold rejects invalid counts", () => {
    const engine = createEngine({ items: ["guest_book"], evidence: ["guest_book"] });

    assert.equal(engine._checkCondition("evidence_count:invalid"), false);
    assert.equal(engine._checkCondition("evidence_count:-1"), false);
});

test("legacy inventory fixtures without an item list retain evidence-pool fallback", () => {
    const engine = createEngine({ evidence: ["guest_book", "wire_fragment"] });

    assert.equal(engine._checkCondition("evidence_count:2"), true);
});
