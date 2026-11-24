import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("dialogue engine records authored claims when the player reaches a testimony node", () => {
    const dialogue = {
        id: "case-001-porter-test",
        npcId: "porter",
        tree: {
            start: "opening",
            nodes: {
                opening: {
                    speaker: "npc",
                    text: "Я могу рассказать, что видел.",
                    answers: [{ text: "Расскажите.", nextNode: "testimony" }]
                },
                testimony: {
                    speaker: "npc",
                    text: "Я видел незнакомца у служебного входа.",
                    claim: {
                        id: "integration-porter-service-entrance",
                        topic: "service-entrance-visitor",
                        value: "porter-saw-unidentified-person-near-service-entrance",
                        summary: "Портье видел неизвестного человека у служебного входа",
                        sourceName: "Фрэнк, портье",
                        circumstances: "Личность человека не установлена",
                        directObservation: true
                    },
                    answers: [{ text: "Спасибо.", nextNode: "end" }]
                },
                end: { speaker: "npc", text: "Больше добавить нечего.", endDialogue: true }
            }
        }
    };
    const recordedClaims = [];
    const context = vm.createContext({
        getDialogueById: id => id === dialogue.id ? dialogue : null,
        events: { emit() {} },
        console
    });
    const source = readFileSync(resolve(root, "assets/js/npc/dialogueEngine.js"), "utf8");
    vm.runInContext(source + "\nglobalThis.DialogueEngineExport = DialogueEngine;", context);
    const engine = new context.DialogueEngineExport(null, null);
    engine.setMemoryService({
        recordDialogueStarted() {},
        recordNodeVisited() {},
        recordAnswerSelected() {},
        recordClaim(npcId, claim) {
            recordedClaims.push({ npcId, ...claim });
            return { added: true, contradictions: [] };
        },
        toJSON() { return {}; }
    });

    assert.equal(engine.startDialogue(dialogue.id), true);
    assert.equal(recordedClaims.length, 0, "opening without a claim must not invent testimony");
    assert.equal(engine.selectAnswer(0).id, "testimony");
    assert.equal(recordedClaims.length, 1, "claim is recorded when the testimony node is reached");
    assert.equal(recordedClaims[0].npcId, "porter");
    assert.equal(recordedClaims[0].id, "integration-porter-service-entrance");
    assert.equal(recordedClaims[0].dialogueId, dialogue.id);
    assert.equal(recordedClaims[0].nodeId, "testimony");
    assert.equal(recordedClaims[0].directObservation, true);
    assert.equal(engine.selectAnswer(0).endDialogue, true);
    assert.equal(recordedClaims.length, 1, "leaving the testimony node must not record it twice");
});
