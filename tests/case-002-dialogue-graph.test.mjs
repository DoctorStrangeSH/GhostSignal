import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const dialogueFixtures = [
    ["assets/data/cases/case-002/dialogues/anna.js", "DIALOGUE_ANNA"],
    ["assets/data/cases/case-002/dialogues/bartender_case2.js", "DIALOGUE_BARTENDER_CASE2"],
    ["assets/data/cases/case-002/dialogues/diner_owner.js", "DIALOGUE_DINER_OWNER"],
    ["assets/data/cases/case-002/dialogues/journalist.js", "DIALOGUE_JOURNALIST"],
    ["assets/data/cases/case-002/dialogues/labour_inspector.js", "DIALOGUE_LABOUR_INSPECTOR"],
    ["assets/data/cases/case-002/dialogues/line_technician.js", "DIALOGUE_LINE_TECHNICIAN"],
    ["assets/data/cases/case-002/dialogues/mill_watchman.js", "DIALOGUE_MILL_WATCHMAN"],
    ["assets/data/cases/case-002/dialogues/pharmacist.js", "DIALOGUE_PHARMACIST"],
    ["assets/data/cases/case-002/dialogues/rival.js", "DIALOGUE_RIVAL_FULL"],
    ["assets/data/cases/case-002/dialogues/telephone_operator.js", "DIALOGUE_TELEPHONE_OPERATOR"],
    ["assets/data/cases/case-002/dialogues/tram_conductor.js", "DIALOGUE_TRAM_CONDUCTOR"],
    ["assets/data/cases/case-002/dialogues/waiter.js", "DIALOGUE_WAITER"],
    ["assets/data/cases/case-002/dialogues/woman_in_red.js", "DIALOGUE_WOMAN_IN_RED"],
    ["assets/data/shared/dialogues/sergeant.js", "DIALOGUE_SERGEANT"]
];

function loadDialogues() {
    const context = vm.createContext({ console: { log() {} } });
    for (const [path] of dialogueFixtures) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }
    return dialogueFixtures.map(([, globalName]) => vm.runInContext(globalName, context));
}

function getDialogueTargets(dialogue) {
    const nodes = dialogue.tree?.nodes || {};
    const targets = [
        ...(dialogue.tree?.entryRules || []).map(rule => rule?.nodeId),
        ...Object.values(nodes).flatMap(node => (node.answers || []).map(answer => answer?.nextNode)),
        ...["evidenceReactions", "contradictionReactions"].flatMap(collection =>
            Object.values(dialogue[collection] || {}).flatMap(reaction =>
                (reaction?.answers || []).map(answer => answer?.nextNode)
            )
        )
    ];
    return targets.filter(Boolean);
}

function reachableNodes(dialogue) {
    const nodes = dialogue.tree?.nodes || {};
    const queue = [dialogue.tree?.start, ...(dialogue.tree?.entryRules || []).map(rule => rule?.nodeId)];
    for (const collection of ["evidenceReactions", "contradictionReactions"]) {
        for (const reaction of Object.values(dialogue[collection] || {})) {
            for (const answer of reaction?.answers || []) {
                if (answer?.nextNode) queue.push(answer.nextNode);
            }
        }
    }

    const visited = new Set();
    while (queue.length) {
        const nodeId = queue.shift();
        if (!nodeId || visited.has(nodeId) || !nodes[nodeId]) continue;
        visited.add(nodeId);
        for (const answer of nodes[nodeId].answers || []) {
            if (answer?.nextNode && !visited.has(answer.nextNode)) queue.push(answer.nextNode);
        }
    }
    return visited;
}

test("all case two dialogue starts, entry points, and answer targets resolve", () => {
    const errors = [];
    for (const dialogue of loadDialogues()) {
        const nodes = dialogue.tree?.nodes || {};
        if (!nodes[dialogue.tree?.start]) errors.push(`${dialogue.id} has a missing start node`);
        for (const target of getDialogueTargets(dialogue)) {
            if (!nodes[target]) errors.push(`${dialogue.id} points to missing node ${target}`);
        }
    }
    assert.deepEqual(errors, []);
});

test("every case two dialogue node is reachable from a start, entry point, or special reaction", () => {
    const unreachable = [];
    for (const dialogue of loadDialogues()) {
        const reachable = reachableNodes(dialogue);
        for (const nodeId of Object.keys(dialogue.tree?.nodes || {})) {
            if (!reachable.has(nodeId)) unreachable.push(`${dialogue.id}/${nodeId}`);
        }
    }
    assert.deepEqual(unreachable, [],
        `Case-two dialogue contains nodes with no route from a start/entry/reaction: ${unreachable.join(", ")}`);
});
