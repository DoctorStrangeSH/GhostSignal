import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadCaseStory(path, expression) {
    const context = vm.createContext({ console });
    vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    return vm.runInContext(expression, context);
}

test("Case 002 presents the detective's reconstruction before Kane confesses", () => {
    const chapter5 = loadCaseStory(
        "assets/data/cases/case-002/story.js",
        "CASE_002_STORY.chapter_5.text"
    );
    const chapter6 = loadCaseStory(
        "assets/data/cases/case-002/story.js",
        "CASE_002_STORY.chapter_6.text"
    );

    assert.match(chapter5, /это пока реконструкция событий, а не признание/i);
    assert.doesNotMatch(chapter5, /по его признанию/i);
    assert.match(chapter5, /противоречат показаниям Евы и официанта/i);
    assert.match(chapter6, /Кейн долго молчит\. Потом начинает говорить/i);
    assert.match(chapter6, /Анна дала мне эту возможность/i);
});

test("Case 001 provides evidence and a witness explanation for the locked-room chain", () => {
    const registry = {};
    const context = vm.createContext({
        console,
        registerData(type, data) {
            registry[type] = { ...(registry[type] || {}), ...data };
        }
    });

    for (const path of [
        "assets/data/cases/case-001/locations.js",
        "assets/data/cases/case-001/objects.js",
        "assets/data/cases/case-001/dialogues/housekeeper.js"
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }

    const room = registry.location.hotel_room_304;
    const chain = registry.object.door_chain;
    const wire = registry.object.wire_fragment;
    const dialogue = vm.runInContext("DIALOGUE_HOUSEKEEPER", context);
    const followUp = dialogue.tree.nodes.full_confession.answers.find(answer =>
        answer.nextNode === "chain_trick_explanation"
    );

    assert.ok(room.defaultItems.includes("door_chain"));
    assert.equal(chain.interactions.examine.givesInsight, "chain_trick");
    assert.equal(chain.interactions.examine.spawnsItem, "wire_fragment");
    assert.equal(wire.isEvidence, true);
    assert.equal(followUp.condition, "hasInsight:chain_trick");
    assert.match(dialogue.tree.nodes.chain_trick_explanation.text, /через щель зацепила цепочку/i);
    assert.match(dialogue.tree.nodes.chain_trick_explanation.text, /кусочек проволоки сломался/i);

    const caseIndex = readFileSync(resolve(root, "assets/data/cases/case-001/index.js"), "utf8");
    const endings = readFileSync(resolve(root, "assets/data/cases/case-001/endings.js"), "utf8");
    assert.match(caseIndex, /highlightObjects: \["bed_304", "carpet_stain", "window_304", "door_chain", "mirror"\]/);
    assert.match(caseIndex, /trigger: "evidence_count:6"/);
    assert.match(endings, /condition: "evidence_count_6"/);
});

test('Mary does not disclose a secret relationship from an unsupported casual question', () => {
    const context = vm.createContext({ console, registerData() {} });
    vm.runInContext(readFileSync(resolve(root, 'assets/data/cases/case-001/dialogues/housekeeper.js'), 'utf8'), context);
    const dialogue = vm.runInContext('DIALOGUE_HOUSEKEEPER', context);
    const nodes = dialogue.tree.nodes;
    const reachable = hasPhoto => {
        const visited = new Set();
        const queue = [dialogue.tree.start];
        while (queue.length) {
            const nodeId = queue.shift();
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);
            for (const answer of nodes[nodeId]?.answers || []) {
                const condition = answer.condition;
                if (condition === 'hasItem:torn_photo' && !hasPhoto) continue;
                if (condition === 'not:hasItem:torn_photo' && hasPhoto) continue;
                // Other clues are unavailable in this minimal conversation.
                if (condition && !['hasItem:torn_photo', 'not:hasItem:torn_photo'].includes(condition)) continue;
                queue.push(answer.nextNode);
            }
        }
        return visited;
    };

    const withoutPhoto = reachable(false);
    assert.ok(withoutPhoto.has('no_alibi'));
    assert.ok(withoutPhoto.has('conversations'));
    assert.ok(withoutPhoto.has('insufficient_relationship_proof'));
    assert.equal(withoutPhoto.has('truth_starts'), false);
    assert.equal(withoutPhoto.has('mary_full_confession'), false);

    const withPhoto = reachable(true);
    assert.ok(withPhoto.has('truth_starts'), 'the photographed relationship must remain a viable lead');
    assert.ok(withPhoto.has('timeline_match'));
});

test("Case 001 accusation requires reachable physical and independent evidence", () => {
    const registry = {};
    const context = vm.createContext({
        console,
        registerData(type, data) {
            registry[type] = { ...(registry[type] || {}), ...data };
        }
    });
    for (const path of [
        "assets/data/cases/case-001/index.js",
        "assets/data/cases/case-001/locations.js",
        "assets/data/cases/case-001/objects.js"
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }
    const caseData = vm.runInContext("CASE_001", context);
    const room = registry.location.hotel_room_304;
    const objects = registry.object;
    assert.equal(room.unlockedByDefault, true);
    for (const [source, item] of [["bed_304", "hidden_note"], ["door_chain", "wire_fragment"]]) {
        assert.ok(room.defaultItems.includes(source));
        assert.equal(objects[source].interactions.examine.spawnsItem, item);
        assert.equal(objects[item].isEvidence, true);
        assert.equal(objects[item].takeable, true);
        assert.ok(caseData.proofRequirements.requiredItems.includes(item));
    }
    assert.equal(objects.wardrobe.interactions.examine.spawnsItem, "small_key");
    assert.equal(objects.mirror.interactions.examine.revealsObject, "wall_safe");
    assert.equal(objects.wall_safe.interactions.unlock.spawnsItem, "victim_diary");
    assert.equal(objects.victim_diary.interactions.examine.givesInsight, "victim_knew_danger");
    assert.ok(caseData.proofRequirements.anyInsights.includes("victim_knew_danger"));
});
