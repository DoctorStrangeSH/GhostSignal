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

function loadAuthoredDialogue(path) {
    const source = readFileSync(resolve(root, path), "utf8");
    const declaration = source.match(/const (DIALOGUE_[A-Z0-9_]+) =/);
    assert.ok(declaration, path + ": dialogue data declaration is missing");
    const context = vm.createContext({ registerData() {} });
    vm.runInContext(source + `\nglobalThis.__dialogue = ${declaration[1]};`, context);
    return context.__dialogue;
}

function findClaimRoute(dialogue, targetNodeId) {
    const roots = [...new Set([dialogue.tree.start,
        ...(Array.isArray(dialogue.tree.entryRules) ? dialogue.tree.entryRules.map(rule => rule.nodeId) : [])])];
    for (const rootNodeId of roots) {
        const queue = [{ nodeId: rootNodeId, answerIndexes: [] }];
        const visited = new Set();
        while (queue.length) {
            const current = queue.shift();
            if (!current.nodeId || visited.has(current.nodeId) || !dialogue.tree.nodes[current.nodeId]) continue;
            visited.add(current.nodeId);
            if (current.nodeId === targetNodeId) return { rootNodeId, answerIndexes: current.answerIndexes };
            (dialogue.tree.nodes[current.nodeId].answers || []).forEach((answer, index) => {
                if (answer.nextNode) queue.push({
                    nodeId: answer.nextNode,
                    answerIndexes: [...current.answerIndexes, index]
                });
            });
        }
    }
    return null;
}

test("real authored testimony nodes are recorded only when reached through dialogue choices", () => {
    const files = [
        "assets/data/cases/case-001/dialogues/porter.js",
        "assets/data/cases/case-001/dialogues/housekeeper.js",
        "assets/data/cases/case-001/dialogues/elias.js",
        "assets/data/cases/case-001/dialogues/wife.js",
        "assets/data/cases/case-001/dialogues/coroner.js",
        "assets/data/cases/case-002/dialogues/bartender_case2.js",
        "assets/data/cases/case-002/dialogues/rival.js",
        "assets/data/cases/case-002/dialogues/waiter.js"
    ];
    const engineSource = readFileSync(resolve(root, "assets/js/npc/dialogueEngine.js"), "utf8");
    let checkedClaims = 0;

    for (const path of files) {
        const authoredDialogue = loadAuthoredDialogue(path);
        for (const [nodeId, node] of Object.entries(authoredDialogue.tree.nodes)) {
            if (!node.claim) continue;
            assert.ok(node.claim.id, path + "/" + nodeId + ": every authored claim needs a stable ID");
            assert.equal(typeof node.claim.directObservation, "boolean",
                path + "/" + nodeId + ": every authored claim must state its observation provenance");
            const route = findClaimRoute(authoredDialogue, nodeId);
            assert.ok(route, path + "/" + nodeId + ": claim node must have a playable route");
            const dialogue = JSON.parse(JSON.stringify(authoredDialogue));
            dialogue.tree.start = route.rootNodeId;
            dialogue.tree.entryRules = [];
            const recordedClaims = [];
            const context = vm.createContext({
                getDialogueById: id => id === dialogue.id ? dialogue : null,
                events: { emit() {} },
                console
            });
            vm.runInContext(engineSource + "\nglobalThis.DialogueEngineExport = DialogueEngine;", context);
            const engine = new context.DialogueEngineExport(null, null);
            engine._checkCondition = () => true;
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

            assert.equal(engine.startDialogue(dialogue.id), true, path + ": dialogue should start");
            for (const answerIndex of route.answerIndexes) {
                const result = engine.selectAnswer(answerIndex);
                assert.ok(result && !result.error, path + "/" + nodeId + ": route answer should be selectable");
            }
            assert.equal(engine.currentNode.id, nodeId, path + ": engine should reach authored claim node");
            const matching = recordedClaims.filter(claim => claim.id === node.claim.id);
            assert.equal(matching.length, 1, path + "/" + nodeId + ": claim must be recorded exactly once");
            assert.equal(matching[0].npcId, dialogue.npcId);
            assert.equal(matching[0].dialogueId, dialogue.id);
            assert.equal(matching[0].nodeId, nodeId);
            assert.equal(matching[0].directObservation, node.claim.directObservation);
            checkedClaims++;
        }
    }
    assert.ok(checkedClaims >= 20, "the acceptance must cover the authored claim set across both cases");
});
