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
        "assets/data/cases/case-001/locations.js",
        "assets/data/cases/case-001/objects.js",
        "assets/data/cases/case-001/dialogues/housekeeper.js"
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }
    return {
        caseData: vm.runInContext("CASE_001", context),
        dialogue: vm.runInContext("DIALOGUE_HOUSEKEEPER", context),
        ...registry
    };
}

function reachableCaseObjects(caseData, locations, objects) {
    const reachable = new Set();
    const items = new Set();
    for (const locationId of caseData.locations) {
        const location = locations[locationId];
        if (!location || location.unlockedByDefault === false) continue;
        for (const objectId of location.defaultItems || []) reachable.add(objectId);
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
                if (result.spawnsItem && !items.has(result.spawnsItem)) {
                    items.add(result.spawnsItem);
                    changed = true;
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
            if (!answer.condition && answer.nextNode) queue.push(answer.nextNode);
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

test("the perfect ending's independent rescue-location insight is reachable in the housekeeper dialogue", () => {
    const { dialogue } = loadCaseOne();
    const locationNode = dialogue.tree.nodes.where_is_he;

    assert.equal(locationNode.givesInsight, "blackwood_location_revealed");
    assert.equal(hasUnconditionalDialoguePath(dialogue, "where_is_he"), true);
});
