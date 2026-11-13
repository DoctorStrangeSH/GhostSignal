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
