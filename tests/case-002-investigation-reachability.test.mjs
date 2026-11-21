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

function loadInvestigation() {
    const registry = {};
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        registerData(type, data) {
            registry[type] = { ...(registry[type] || {}), ...data };
        }
    });

    for (const path of [
        "assets/data/cases/case-001/locations.js",
        "assets/data/cases/case-002/locations.js",
        "assets/data/cases/case-002/objects.js",
        "assets/data/cases/case-002/index.js",
        ...dialogueFixtures.map(([path]) => path)
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }

    return {
        caseData: vm.runInContext("CASE_002", context),
        locations: registry.location,
        objects: registry.object,
        dialogues: dialogueFixtures.map(([, globalName]) => vm.runInContext(globalName, context))
    };
}

function collectReachableSceneObjects(caseData, locations, objects) {
    const reachableObjects = new Set();
    const obtainedItems = new Set();

    for (const locationId of caseData.locations) {
        const location = locations[locationId];
        if (!location || location.unlockedByDefault === false) continue;
        for (const objectId of location.defaultItems || []) reachableObjects.add(objectId);
    }

    for (const scene of caseData.scenes || []) {
        const location = locations[scene.locationId];
        if (location && location.unlockedByDefault !== false) {
            for (const objectId of scene.highlightObjects || []) reachableObjects.add(objectId);
        }
    }

    let changed = true;
    while (changed) {
        changed = false;

        for (const objectId of [...reachableObjects]) {
            const object = objects[objectId];
            if (!object) continue;

            for (const interaction of Object.values(object.interactions || {})) {
                if (!interaction) continue;

                if (interaction.spawnsItem && !obtainedItems.has(interaction.spawnsItem)) {
                    obtainedItems.add(interaction.spawnsItem);
                    changed = true;
                }
                if (interaction.spawnsItem && objects[interaction.spawnsItem] &&
                    !reachableObjects.has(interaction.spawnsItem)) {
                    reachableObjects.add(interaction.spawnsItem);
                    changed = true;
                }
                if (interaction.revealsObject && !reachableObjects.has(interaction.revealsObject)) {
                    reachableObjects.add(interaction.revealsObject);
                    changed = true;
                }
            }
        }

        for (const [objectId, object] of Object.entries(objects)) {
            if (object.requiresItem && obtainedItems.has(object.requiresItem) &&
                !reachableObjects.has(objectId)) {
                reachableObjects.add(objectId);
                changed = true;
            }
        }
    }

    return { reachableObjects, obtainedItems };
}

function reachableDialogueNodes(dialogue) {
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

test("case two accusation proof items have obtainable sources in accessible locations", () => {
    const { caseData, locations, objects } = loadInvestigation();
    const { reachableObjects, obtainedItems } = collectReachableSceneObjects(caseData, locations, objects);

    for (const itemId of caseData.proofRequirements.requiredItems) {
        assert.ok(obtainedItems.has(itemId) || reachableObjects.has(itemId),
            `Required proof item ${itemId} must be obtainable from an accessible scene`);
        assert.equal(objects[itemId]?.isEvidence, true,
            `Required proof item ${itemId} must be registered as evidence`);
    }

    assert.ok(reachableObjects.has("prescription_journal"),
        "the pharmacy journal must be accessible as the source of the prescription copy");
    assert.ok(reachableObjects.has("press_photos"),
        "the press photo archive must be accessible as the source of the bar photograph");
});

test("case two accusation corroboration has a reachable authored dialogue source", () => {
    const { caseData, dialogues } = loadInvestigation();
    const sources = [];

    for (const dialogue of dialogues) {
        const reachable = reachableDialogueNodes(dialogue);
        for (const [nodeId, node] of Object.entries(dialogue.tree?.nodes || {})) {
            if (node.givesInsight && caseData.proofRequirements.anyInsights.includes(node.givesInsight) &&
                reachable.has(nodeId)) {
                sources.push(`${dialogue.id}/${nodeId}/${node.givesInsight}`);
            }
        }
    }

    assert.ok(sources.length > 0,
        "at least one alternative corroboration insight must have a reachable dialogue source");
    assert.ok(sources.some(source => source.endsWith("/hard_evidence_kane")),
        "the journalist's independently assembled evidence must remain a reachable alternative");
});

test("the case-two search warrant has a reachable sergeant dialogue source", () => {
    const { dialogues } = loadInvestigation();
    const sergeant = dialogues.find(dialogue => dialogue.npcId === "sergeant");
    assert.ok(sergeant, "the shared sergeant dialogue must be loaded for case two");

    const reachable = reachableDialogueNodes(sergeant);
    const warrantNode = Object.entries(sergeant.tree?.nodes || {}).find(([nodeId, node]) =>
        node.givesEvidence === "search_warrant" && reachable.has(nodeId)
    );

    assert.ok(warrantNode,
        "the player must be able to obtain the search warrant through a reachable sergeant dialogue node");
});
