import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createEngineHarness() {
    const dialogue = {
        id: "dialogue-resume-fixture",
        npcId: "witness",
        tree: {
            start: "greeting",
            nodes: {
                greeting: {
                    speaker: "npc",
                    text: "Добрый вечер.",
                    answers: [{ text: "Спросить о времени", nextNode: "time_question" }]
                },
                time_question: {
                    speaker: "npc",
                    text: "Я ушёл до полуночи.",
                    answers: [{ text: "Уточнить", nextNode: "clarification" }]
                },
                clarification: {
                    speaker: "npc",
                    text: "Около одиннадцати.",
                    answers: [{ text: "Закончить", nextNode: "goodbye" }]
                },
                goodbye: { speaker: "npc", text: "До свидания.", endDialogue: true, answers: [] }
            },
            entryRules: []
        },
        evidenceReactions: {
            torn_letter: {
                text: "Я узнаю этот почерк.",
                answers: [{ text: "Кто написал письмо?", nextNode: "clarification" }]
            }
        }
    };
    let advances = 0;
    let memoryWrites = 0;
    const context = vm.createContext({
        console: { error() {} },
        CONFIG: { time: { costs: { dialogue: 5 } } },
        events: { emit() {} },
        getDialogueById: id => id === dialogue.id ? dialogue : null,
        getObjectById: id => id === "torn_letter" ? { id, isEvidence: true } : null
    });
    const source = readFileSync(resolve(root, "assets/js/npc/dialogueEngine.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__DialogueEngine = DialogueEngine;", context);
    const time = { advance() { advances++; } };
    const engine = new context.__DialogueEngine({}, time);
    engine.memoryService = {
        recordNodeVisited() { memoryWrites++; },
        recordDialogueStarted() { memoryWrites++; }
    };
    return { Engine: context.__DialogueEngine, engine, dialogue, advances: () => advances, memoryWrites: () => memoryWrites };
}

test("active dialogue snapshot restores the exact node and trusted answer definitions", () => {
    const { Engine, engine, dialogue } = createEngineHarness();
    engine.currentDialogue = dialogue;
    engine.currentStableNodeId = "time_question";
    engine.currentNode = { id: "time_question", ...dialogue.tree.nodes.time_question };
    engine.dialogueHistory = [
        { nodeId: "greeting", speaker: "npc", text: "Добрый вечер." },
        { nodeId: "time_question", speaker: "npc", text: "Я ушёл до полуночи." }
    ];

    const snapshot = engine.toJSON();
    const restored = new Engine({}, { advance() { throw new Error("restore must not advance time"); } });
    let memoryWrites = 0;
    restored.memoryService = {
        recordNodeVisited() { memoryWrites++; },
        recordDialogueStarted() { memoryWrites++; }
    };

    assert.equal(restored.restoreFromJSON(snapshot), true);
    assert.equal(restored.currentDialogue.id, dialogue.id);
    assert.equal(restored.currentNode.id, "time_question");
    assert.equal(restored.currentNode.text, "Я ушёл до полуночи.");
    assert.equal(restored.currentNode.answers[0].nextNode, "clarification");
    assert.deepEqual(JSON.parse(JSON.stringify(restored.getHistory())), snapshot.history);
    assert.equal(memoryWrites, 0, "loading must not record another visit or conversation");
});

test("active evidence reaction restores its scripted answers without trusting saved answer payloads", () => {
    const { Engine, engine, dialogue } = createEngineHarness();
    engine.currentDialogue = dialogue;
    engine.currentStableNodeId = "time_question";
    engine.currentNode = {
        id: "evidence_torn_letter",
        speaker: "npc",
        text: "Я узнаю этот почерк.",
        answers: dialogue.evidenceReactions.torn_letter.answers
    };
    engine.dialogueHistory = [
        { nodeId: "time_question", speaker: "npc", text: "Я ушёл до полуночи." },
        { nodeId: "evidence_torn_letter", speaker: "npc", text: "Я узнаю этот почерк." }
    ];

    const snapshot = engine.toJSON();
    snapshot.answers = [{ text: "ПОДМЕНЁННЫЙ ОТВЕТ", nextNode: "missing_node" }];
    const restored = new Engine({}, { advance() {} });
    assert.equal(restored.restoreFromJSON(snapshot), true);
    assert.equal(restored.currentNode.id, "evidence_torn_letter");
    assert.equal(restored.currentNode.answers[0].text, "Кто написал письмо?");
    assert.notEqual(restored.currentNode.answers[0].text, "ПОДМЕНЁННЫЙ ОТВЕТ");
});

test("invalid, unknown, and cross-NPC dialogue snapshots are rejected without partial state", () => {
    const { Engine, engine, dialogue } = createEngineHarness();
    const restored = new Engine({}, { advance() {} });

    assert.equal(restored.restoreFromJSON(null), false);
    assert.equal(restored.restoreFromJSON({
        dialogueId: "unknown-dialogue", npcId: "witness",
        nodeId: "greeting", stableNodeId: "greeting"
    }), false);
    assert.equal(restored.restoreFromJSON({
        dialogueId: dialogue.id, npcId: "different-npc",
        nodeId: "greeting", stableNodeId: "greeting"
    }), false);
    assert.equal(restored.restoreFromJSON({
        dialogueId: dialogue.id, npcId: "witness",
        nodeId: "missing-node", stableNodeId: "greeting"
    }), false);
    assert.equal(restored.currentDialogue, null);
    assert.equal(restored.currentNode, null);
});

test("reset clears all serializable active dialogue state", () => {
    const { engine, dialogue } = createEngineHarness();
    engine.currentDialogue = dialogue;
    engine.currentStableNodeId = "greeting";
    engine.currentNode = { id: "greeting", text: "Привет." };
    engine.dialogueHistory = [{ nodeId: "greeting", speaker: "npc", text: "Привет." }];

    engine.reset();
    assert.equal(engine.toJSON(), null);
    assert.equal(engine.currentStableNodeId, null);
    assert.deepEqual(engine.getHistory(), []);
});
