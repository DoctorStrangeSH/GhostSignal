import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadCaseOne() {
    const registry = {};
    const context = vm.createContext({
        console: { log() {} },
        registerData(type, data) {
            registry[type] = { ...(registry[type] || {}), ...data };
        }
    });
    for (const path of [
        "assets/data/cases/case-001/index.js",
        "assets/data/cases/case-001/endings.js",
        "assets/data/cases/case-001/locations.js",
        "assets/data/cases/case-001/objects.js",
        "assets/data/cases/case-001/dialogues/housekeeper.js",
        "assets/data/cases/case-001/dialogues/porter.js",
        "assets/data/cases/case-001/dialogues/coroner.js",
        "assets/data/cases/case-001/dialogues/elias.js",
        "assets/data/cases/case-001/dialogues/wife.js",
        "assets/data/shared/dialogues/bartender.js",
        "assets/data/shared/dialogues/sergeant.js"
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }
    return {
        caseData: vm.runInContext("CASE_001", context),
        dialogues: [
            vm.runInContext("DIALOGUE_HOUSEKEEPER", context),
            vm.runInContext("DIALOGUE_PORTER", context),
            vm.runInContext("DIALOGUE_CORONER", context),
            vm.runInContext("DIALOGUE_ELIAS", context),
            vm.runInContext("DIALOGUE_WIFE", context),
            vm.runInContext("DIALOGUE_BARTENDER", context),
            vm.runInContext("DIALOGUE_SERGEANT", context)
        ],
        locations: registry.location,
        object: registry.object,
        endings: registry.ending
    };
}

function reachableCaseObjects(caseData, locations, objects) {
    const reachable = new Set();
    const items = new Set();
    for (const locationId of caseData.locations) {
        const location = locations[locationId];
        if (!location || location.unlockedByDefault === false) continue;
        for (const objectId of [...(location.defaultItems || []), ...(location.nightOnlyItems || [])]) {
            reachable.add(objectId);
        }
    }

    // Resolve ordinary examination, revealed objects, and keyed containers
    // until no additional scene object or evidence item can be discovered.
    let changed = true;
    while (changed) {
        changed = false;
        for (const objectId of [...reachable]) {
            const object = objects[objectId];
            if (!object) continue;
            const examine = object.interactions?.examine;
            const unlock = object.requiresItem && !items.has(object.requiresItem)
                ? null
                : object.interactions?.unlock;
            for (const result of [examine, unlock]) {
                if (!result) continue;
                if (result.spawnsItem) {
                    if (!items.has(result.spawnsItem)) {
                        items.add(result.spawnsItem);
                        changed = true;
                    }
                    if (objects[result.spawnsItem] && !reachable.has(result.spawnsItem)) {
                        reachable.add(result.spawnsItem);
                        changed = true;
                    }
                }
                if (result.revealsObject && !reachable.has(result.revealsObject)) {
                    reachable.add(result.revealsObject);
                    changed = true;
                }
            }
            if (object.requiresItem && items.has(object.requiresItem) && !reachable.has(objectId)) {
                reachable.add(objectId);
                changed = true;
            }
        }
        for (const [objectId, object] of Object.entries(objects)) {
            if (object.requiresItem && items.has(object.requiresItem) && !reachable.has(objectId)) {
                reachable.add(objectId);
                changed = true;
            }
        }
    }

    return { reachable, items };
}

function hasUnconditionalDialoguePath(dialogue, targetId) {
    const visited = new Set();
    const queue = [dialogue.tree.start];
    while (queue.length) {
        const id = queue.shift();
        if (id === targetId) return true;
        if (visited.has(id)) continue;
        visited.add(id);
        for (const answer of dialogue.tree.nodes[id]?.answers || []) {
            if (answer.nextNode) queue.push(answer.nextNode);
        }
    }
    return false;
}

test("case one accusation evidence has playable sources in locations available to the investigation", () => {
    const { caseData, locations, object } = loadCaseOne();
    const { reachable, items } = reachableCaseObjects(caseData, locations, object);

    for (const itemId of caseData.proofRequirements.requiredItems) {
        assert.ok(items.has(itemId) || reachable.has(itemId),
            `Required proof item ${itemId} must be obtainable from an accessible scene`);
        assert.equal(object[itemId]?.isEvidence, true, `${itemId} must be registered as evidence`);
    }

    for (const insightId of caseData.proofRequirements.anyInsights) {
        const source = [...reachable].find(objectId =>
            object[objectId]?.interactions?.examine?.givesInsight === insightId
        );
        assert.ok(source, `Alternative corroboration ${insightId} must have an accessible examination source`);
    }
});

test("the victim apartment points to Victoria's case-specific desk and its evidence reward", () => {
    const { locations, object } = loadCaseOne();
    const apartment = locations.victim_apartment;

    assert.ok(apartment.defaultItems.includes("wife_desk"),
        "the Blackwood apartment must render Victoria's desk, not the generic desk object");
    assert.equal(object.wife_desk?.id, "wife_desk");
    assert.equal(object.wife_desk?.interactions?.examine?.spawnsItem, "detective_photos");
    assert.equal(object.wife_desk?.interactions?.examine?.givesInsight, "wife_hired_detective");
});

test("every default object in the victim apartment resolves to an examinable case object", () => {
    const { locations, object } = loadCaseOne();
    const apartment = locations.victim_apartment;

    assert.ok(apartment, "the victim apartment must exist");
    for (const objectId of apartment.defaultItems) {
        assert.ok(object[objectId], `victim apartment object ${objectId} must be defined`);
        assert.ok(object[objectId].interactions?.examine,
            `victim apartment object ${objectId} must have an examine interaction`);
    }
});

test("the perfect ending's independent rescue-location insight is reachable in the housekeeper dialogue", () => {
    const { dialogues } = loadCaseOne();
    const housekeeper = dialogues.find(dialogue => dialogue.npcId === "housekeeper");
    const locationNode = housekeeper.tree.nodes.where_is_he;

    assert.equal(locationNode.givesInsight, "blackwood_location_revealed");
    assert.equal(hasUnconditionalDialoguePath(housekeeper, "where_is_he"), true);
});


function collectConditionAtoms(condition) {
    if (typeof condition !== "string" || !condition) return [];
    if (condition.startsWith("not:")) return collectConditionAtoms(condition.slice(4));
    if (condition.startsWith("all:") || condition.startsWith("any:")) {
        return condition.slice(condition.indexOf(":") + 1)
            .split("&").flatMap(collectConditionAtoms);
    }
    return [condition];
}

test("the perfect ending requires confession and the explicit rescue location", () => {
    const { dialogues, endings } = loadCaseOne();
    const housekeeper = dialogues.find(dialogue => dialogue.npcId === "housekeeper");
    const confession = housekeeper.tree.nodes.full_confession;
    const location = housekeeper.tree.nodes.where_is_he;
    const perfectEnding = endings["case-001-perfect"];

    assert.equal(confession.givesInsight, "mary_full_confession");
    assert.ok(confession.answers.some(answer =>
        answer.nextNode === "where_is_he" && !answer.condition),
        "the detective must be able to ask where Blackwood is immediately after the confession");
    assert.equal(location.givesInsight, "blackwood_location_revealed");
    assert.equal(perfectEnding.condition, "mary_full_confession");
    assert.deepEqual(Array.from(perfectEnding.requiredInsights), ["blackwood_location_revealed"]);
});

test("case one dialogue prerequisites always reference obtainable evidence or an existing insight source", () => {
    const { dialogues, object } = loadCaseOne();
    const objectInsights = Object.values(object)
        .flatMap(entry => Object.values(entry.interactions || {}))
        .map(interaction => interaction?.givesInsight)
        .filter(Boolean);
    const dialogueInsights = dialogues.flatMap(dialogue =>
        Object.values(dialogue.tree.nodes)
            .map(node => node.givesInsight)
            .filter(Boolean)
    );
    const availableInsights = new Set([...objectInsights, ...dialogueInsights]);

    for (const dialogue of dialogues) {
        for (const [nodeId, node] of Object.entries(dialogue.tree.nodes)) {
            for (const answer of node.answers || []) {
                for (const atom of collectConditionAtoms(answer.condition)) {
                    if (atom.startsWith("hasInsight:")) {
                        const insightId = atom.slice("hasInsight:".length);
                        assert.ok(availableInsights.has(insightId),
                            `Dialogue ${dialogue.id}/${nodeId} requires insight ${insightId}, but no case-one source provides it`);
                    }
                    if (atom.startsWith("hasItem:")) {
                        const itemId = atom.slice("hasItem:".length);
                        assert.ok(object[itemId],
                            `Dialogue ${dialogue.id}/${nodeId} requires missing item ${itemId}`);
                    }
                }
            }
        }
    }
});


function reachableDialogueNodes(dialogue) {
    const nodes = dialogue.tree?.nodes || {};
    const queue = [dialogue.tree?.start];
    for (const rule of dialogue.tree?.entryRules || []) {
        if (rule?.nodeId) queue.push(rule.nodeId);
    }
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

test("every case one dialogue node is reachable from its start or an explicit entry point", () => {
    const { dialogues } = loadCaseOne();
    const unreachable = [];

    for (const dialogue of dialogues) {
        const reachable = reachableDialogueNodes(dialogue);
        for (const nodeId of Object.keys(dialogue.tree?.nodes || {})) {
            if (!reachable.has(nodeId)) unreachable.push(`${dialogue.id}/${nodeId}`);
        }
    }

    assert.deepEqual(unreachable, [],
        `Case-one dialogue contains nodes with no route from a start/entry point: ${unreachable.join(", ")}`);
});

test("case one dialogue entry points and answer targets all resolve to existing nodes", () => {
    const { dialogues } = loadCaseOne();
    const errors = [];

    for (const dialogue of dialogues) {
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

        if (!nodes[dialogue.tree?.start]) errors.push(`${dialogue.id} has a missing start node`);
        for (const target of targets) {
            if (target && !nodes[target]) errors.push(`${dialogue.id} points to missing node ${target}`);
        }
    }

    assert.deepEqual(errors, []);
});


test("every gated case-one location has an obtainable unlock item", () => {
    const { caseData, locations, object, dialogues } = loadCaseOne();
    const { reachable, items } = reachableCaseObjects(caseData, locations, object);
    const failures = [];
    const accessibleEvidence = new Set([...reachable, ...items].filter(itemId =>
        object[itemId]?.isEvidence === true && object[itemId]?.takeable === true
    ));
    assert.ok(accessibleEvidence.size >= 3,
        `case one must expose at least three distinct collectible evidence items; found ${accessibleEvidence.size}`);

    const sergeant = dialogues.find(dialogue => dialogue.npcId === "sergeant");
    assert.ok(sergeant, "the shared sergeant dialogue must be loaded for case one");
    const opening = sergeant.tree?.nodes?.[sergeant.tree?.start];
    const warrantOption = (opening?.answers || []).find(answer => answer.nextNode === "warrant_request");
    assert.ok(warrantOption, "the sergeant must offer a warrant request in the opening dialogue");
    assert.equal(warrantOption.condition, "evidence_count:3",
        "the warrant request must require three distinct collected evidence items");
    assert.equal(sergeant.tree.nodes.review_evidence?.givesEvidence, "search_warrant",
        "the evidence review must grant the warrant needed by the locked apartment");

    for (const locationId of caseData.locations) {
        const location = locations[locationId];
        if (!location || location.unlockedByDefault !== false) continue;

        const requiredItem = location.requiresItem;
        if (!requiredItem) {
            failures.push(`${locationId} is locked but declares no unlock item`);
            continue;
        }

        const sceneSource = items.has(requiredItem) || reachable.has(requiredItem);
        const dialogueSource = dialogues.some(dialogue => {
            const reachableNodes = reachableDialogueNodes(dialogue);
            return Object.entries(dialogue.tree?.nodes || {}).some(([nodeId, node]) =>
                node.givesEvidence === requiredItem && reachableNodes.has(nodeId)
            );
        });

        assert.ok(object[requiredItem] || dialogueSource,
            `${locationId} requires missing unlock item ${requiredItem}`);
        assert.ok(sceneSource || dialogueSource,
            `${locationId} requires ${requiredItem}, but no accessible scene or reachable dialogue grants it`);
    }

    assert.deepEqual(failures, []);
});

test("the train-station unlock clue is available through the alley's night-only scene path", () => {
    const { caseData, locations, object } = loadCaseOne();
    const { reachable, items } = reachableCaseObjects(caseData, locations, object);

    assert.ok(reachable.has("hidden_suitcase"),
        "the night-only suitcase must be considered reachable in the accessible alley");
    assert.ok(items.has("train_ticket") || reachable.has("train_ticket"),
        "examining the suitcase must make the train ticket obtainable");
    assert.equal(object.train_ticket?.isEvidence, true);
});
