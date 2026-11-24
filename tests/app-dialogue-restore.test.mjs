import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadAppPrototype() {
    const context = vm.createContext({
        console,
        document: { addEventListener() {} }
    });
    const source = readFileSync(resolve(root, "assets/js/core/app.js"), "utf8");
    vm.runInContext(source + "\nglobalThis.AppExport = App;", context);
    return context.AppExport.prototype;
}

function createApp(snapshot, activeCase, expectedDialogueId) {
    const calls = [];
    const app = Object.create(loadAppPrototype());
    app.progress = { activeCase, dialogueData: snapshot };
    app.npcManager = {
        getDialogueForNPC(npcId) {
            calls.push({ type: "resolve", npcId });
            return expectedDialogueId;
        }
    };
    app.callInterface = {
        restoreActiveDialogue(value) {
            calls.push({ type: "restore", value });
            return true;
        }
    };
    return { app, calls };
}

const validSnapshot = {
    caseId: "case-002",
    npcId: "journalist",
    dialogueId: "dialogue-journalist",
    nodeId: "investigation",
    stableNodeId: "investigation",
    history: [{ nodeId: "investigation", speaker: "npc", text: "Я следила за Кейном." }]
};

test("app restores an interrupted dialogue only for the matching active case and NPC dialogue", () => {
    const { app, calls } = createApp(
        structuredClone(validSnapshot), "case-002", "dialogue-journalist"
    );

    assert.equal(app.restoreInterruptedDialogue("case-002"), true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].type, "resolve");
    assert.equal(calls[0].npcId, "journalist");
    assert.equal(calls[1].type, "restore");
    assert.equal(calls[1].value.dialogueId, "dialogue-journalist");
    assert.ok(app.progress.dialogueData, "valid snapshot remains available for subsequent saves");
});

test("app rejects a stale dialogue snapshot from another investigation without opening a call", () => {
    const { app, calls } = createApp(
        structuredClone(validSnapshot), "case-001", "dialogue-journalist"
    );

    assert.equal(app.restoreInterruptedDialogue("case-001"), false);
    assert.deepEqual(calls, []);
    assert.equal(app.progress.dialogueData, null);
});

test("app rejects a dialogue that is not the active NPC's case-specific dialogue", () => {
    const snapshot = { ...structuredClone(validSnapshot), dialogueId: "dialogue-bartender-case2" };
    const { app, calls } = createApp(snapshot, "case-002", "dialogue-journalist");

    assert.equal(app.restoreInterruptedDialogue("case-002"), false);
    assert.deepEqual(calls, [
        { type: "resolve", npcId: "journalist" }
    ]);
    assert.equal(app.progress.dialogueData, null);
});

test("app rejects a snapshot when the NPC has no dialogue in the active investigation", () => {
    const { app, calls } = createApp(
        structuredClone(validSnapshot), "case-002", null
    );

    assert.equal(app.restoreInterruptedDialogue("case-002"), false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, "resolve");
    assert.equal(app.progress.dialogueData, null);
});

test("app clears a snapshot when the call interface cannot restore it", () => {
    const app = Object.create(loadAppPrototype());
    app.progress = { activeCase: "case-002", dialogueData: structuredClone(validSnapshot) };
    app.npcManager = { getDialogueForNPC: () => "dialogue-journalist" };
    app.callInterface = { restoreActiveDialogue: () => false };

    assert.equal(app.restoreInterruptedDialogue("case-002"), false);
    assert.equal(app.progress.dialogueData, null);
});
