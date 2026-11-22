import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadKaneDialogueHarness() {
    let dialogue = null;
    let timeAdvances = 0;
    let memoryWrites = 0;
    let insightWrites = 0;
    const context = vm.createContext({
        console: { error() {} },
        CONFIG: { time: { costs: { dialogue: 5 } } },
        events: { emit() {} },
        registerData(type, value) {
            if (type === "dialogue" && value.id === "dialogue-rival-full") dialogue = value;
        },
        getDialogueById(id) { return id === dialogue?.id ? dialogue : null; },
        getObjectById() { return null; }
    });

    vm.runInContext(
        readFileSync(resolve(root, "assets/data/cases/case-002/dialogues/rival.js"), "utf8"),
        context
    );
    vm.runInContext(
        readFileSync(resolve(root, "assets/js/npc/dialogueEngine.js"), "utf8") +
            "\nglobalThis.DialogueEngineExport = DialogueEngine;",
        context
    );

    const makeEngine = () => {
        const engine = new context.DialogueEngineExport({}, {
            advance() { timeAdvances++; }
        });
        engine.memoryService = {
            recordNodeVisited() { memoryWrites++; },
            recordDialogueStarted() { memoryWrites++; }
        };
        engine.inventory = {
            addInsight() { insightWrites++; },
            hasInsight() { return false; }
        };
        return engine;
    };

    return {
        dialogue,
        makeEngine,
        counters: () => ({ timeAdvances, memoryWrites, insightWrites })
    };
}

test("Kane's confession chain survives a save/load at every decisive dialogue node", () => {
    const { dialogue, makeEngine, counters } = loadKaneDialogueHarness();
    const decisiveNodes = [
        "confrontation",
        "why",
        "confession",
        "murder_decision",
        "final_decision",
        "realization",
        "formal_confession",
        "end_rival"
    ];
    const engine = makeEngine();

    for (const nodeId of decisiveNodes) {
        const authoredNode = dialogue.tree.nodes[nodeId];
        assert.ok(authoredNode, `missing authored Kane node: ${nodeId}`);

        engine.currentDialogue = dialogue;
        engine.currentStableNodeId = nodeId;
        engine.currentNode = { id: nodeId, ...authoredNode };
        engine.dialogueHistory = [
            { nodeId: "confrontation", speaker: "npc", text: dialogue.tree.nodes.confrontation.text },
            { nodeId, speaker: "npc", text: authoredNode.text }
        ];

        const snapshot = JSON.parse(JSON.stringify(engine.toJSON()));
        const restored = makeEngine();
        assert.equal(restored.restoreFromJSON(snapshot), true, `failed to restore ${nodeId}`);
        assert.equal(restored.currentDialogue.id, "dialogue-rival-full");
        assert.equal(restored.currentDialogue.npcId, "business_rival");
        assert.equal(restored.currentStableNodeId, nodeId);
        assert.equal(restored.currentNode.id, nodeId);
        assert.equal(restored.currentNode.text, authoredNode.text);
        assert.deepEqual(
            JSON.parse(JSON.stringify(restored.currentNode.answers || [])),
            JSON.parse(JSON.stringify(authoredNode.answers || [])),
            `authored answer options changed after restoring ${nodeId}`
        );
        assert.deepEqual(
            JSON.parse(JSON.stringify(restored.getHistory())),
            JSON.parse(JSON.stringify(snapshot.history))
        );
    }

    assert.deepEqual(counters(), { timeAdvances: 0, memoryWrites: 0, insightWrites: 0 },
        "restoring a saved node must not replay time, memory, or insight effects");
});

test("restoring the formal confession does not grant its insight a second time", () => {
    const { dialogue, makeEngine, counters } = loadKaneDialogueHarness();
    const engine = makeEngine();
    const nodeId = "formal_confession";
    engine.currentDialogue = dialogue;
    engine.currentStableNodeId = nodeId;
    engine.currentNode = { id: nodeId, ...dialogue.tree.nodes[nodeId] };
    engine.dialogueHistory = [{ nodeId, speaker: "npc", text: engine.currentNode.text }];

    const snapshot = engine.toJSON();
    const restored = makeEngine();
    assert.equal(restored.restoreFromJSON(snapshot), true);
    assert.equal(restored.currentNode.givesInsight, "full_confession_kane");
    assert.deepEqual(counters(), { timeAdvances: 0, memoryWrites: 0, insightWrites: 0 });
});
