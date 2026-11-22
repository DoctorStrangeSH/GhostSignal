import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadCallInterface() {
    const events = [];
    const status = { textContent: "", classList: { add() {} } };
    const wave = { style: { display: "flex" } };
    const context = vm.createContext({
        console,
        events: { emit(name, detail) { events.push({ name, detail }); } },
        getNPCById(id) {
            return id === "bartender"
                ? { id, name: "Бармен", role: "Свидетель", dialogueId: "dialogue-bartender" }
                : null;
        },
        document: {
            getElementById(id) { return id === "call-status" ? status : null; },
            createElement() { return { className: "", textContent: "", append() {} }; }
        }
    });
    const source = readFileSync(resolve(root, "assets/js/npc/callInterface.js"), "utf8");
    vm.runInContext(source + "\nglobalThis.CallInterfaceExport = CallInterface;", context);
    return { CallInterface: context.CallInterfaceExport, events, status, wave };
}

test("restoring an interrupted case-specific call uses the saved dialogue id", () => {
    const { CallInterface, events, status, wave } = loadCallInterface();
    const snapshot = {
        caseId: "case-002",
        dialogueId: "dialogue-bartender-case2",
        npcId: "bartender",
        nodeId: "after_visit",
        stableNodeId: "after_visit",
        history: [{ nodeId: "after_visit", speaker: "npc", text: "Я видел его у входа." }]
    };
    const engine = {
        restored: null,
        onNodeChange: null,
        restoreFromJSON(value) { this.restored = value; return true; },
        getHistory() { return snapshot.history; },
        currentNode: { id: "after_visit", text: "Я видел его у входа." },
        toJSON() { return snapshot; }
    };
    const call = Object.create(CallInterface.prototype);
    call.dialogueEngine = engine;
    call.callModal = { querySelector(selector) { return selector === ".call-wave-animation" ? wave : null; } };
    call._showCallingScreen = npc => { call.shownNpc = npc; };
    call._updateDialogueUI = node => { call.renderedNode = node; };
    call._startCallTimer = () => { call.timerStarted = true; };
    call._appendPlayerStatement = text => { call.playerStatements = [...(call.playerStatements || []), text]; };

    assert.equal(call.restoreActiveDialogue(snapshot), true);
    assert.equal(engine.restored, snapshot);
    assert.equal(call.currentNPC.id, "bartender");
    assert.equal(call.currentDialogueId, "dialogue-bartender-case2");
    assert.notEqual(call.currentDialogueId, call.currentNPC.dialogueId,
        "case-specific override must not be replaced with the shared NPC default");
    assert.equal(call.isCallActive, true);
    assert.equal(call.renderedNode.id, "after_visit");
    assert.equal(call.timerStarted, true);
    assert.equal(status.textContent, "СОЕДИНЁН");
    assert.equal(wave.style.display, "none");
    assert.ok(events.some(event => event.name === "call:connected" &&
        event.detail.npcId === "bartender" && event.detail.resumed === true));
});


test("startCall stores an explicit case dialogue before the delayed connection", () => {
    const source = readFileSync(resolve(root, "assets/js/npc/callInterface.js"), "utf8");
    assert.match(source, /startCall\(npcId, dialogueId = null\)/);
    assert.match(source, /this\.currentDialogueId = dialogueId \|\| npc\.dialogueId \|\| null;/);
    assert.match(source, /const dialogueId = this\.currentDialogueId \|\| npc\.dialogueId;/);
});

test("ending an active call emits dialogue:ended once and resets the dialogue engine", () => {
    const { CallInterface, events } = loadCallInterface();
    const call = Object.create(CallInterface.prototype);
    let resets = 0;
    call.isCallActive = true;
    call.currentNPC = { id: "bartender" };
    call.dialogueEngine = {
        currentDialogue: { id: "dialogue-bartender-case2", npcId: "bartender" },
        reset() {
            resets++;
            this.currentDialogue = null;
        }
    };
    call.callModal = { classList: { add() {} } };
    call._connectionTimeout = null;
    call._timerInterval = null;
    call._ringtoneOscillator = null;
    call._callStartTime = 123;

    call.endCall();

    assert.equal(call.isCallActive, false);
    assert.equal(call.currentNPC, null);
    assert.equal(call._callStartTime, null);
    assert.equal(resets, 1);
    assert.deepEqual(events.map(event => event.name), ["dialogue:ended", "call:ended"]);
    assert.equal(events[0].detail.npcId, "bartender");

    // A duplicate hang-up cannot emit another end event or reset a second time.
    call.endCall();
    assert.deepEqual(events.map(event => event.name), ["dialogue:ended", "call:ended"]);
    assert.equal(resets, 1);
});
