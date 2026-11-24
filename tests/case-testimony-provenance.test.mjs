import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDialogue(path) {
    const source = readFileSync(resolve(root, path), "utf8");
    const declaration = source.match(/const (DIALOGUE_[A-Z0-9_]+) =/);
    assert.ok(declaration, path + ": dialogue data declaration is missing");
    const context = vm.createContext({ registerData() {} });
    vm.runInContext(source + `\nglobalThis.__dialogue = ${declaration[1]};`, context);
    return context.__dialogue.tree.nodes;
}

const caseOne = [
    ["porter.js", ["know_woman", "last_sighting", "relationship", "smell_description", "maid_said", "visitors", "argument"]],
    ["housekeeper.js", ["timeline_match", "full_confession", "chain_trick_explanation", "where_is_he"]],
    ["elias.js", ["what_he_did", "changed_mind", "decision"]],
    ["wife.js", ["how_she_found_out", "threats_question", "alibi"]],
    ["coroner.js", ["analysis_results", "more_details"]]
];

test("case 001 critical testimony records source, context and observation limits", () => {
    for (const [file, nodeIds] of caseOne) {
        const nodes = loadDialogue(`assets/data/cases/case-001/dialogues/${file}`);
        for (const nodeId of nodeIds) {
            const claim = nodes[nodeId]?.claim;
            assert.ok(claim, `${file}/${nodeId}: critical testimony must be recorded as a claim`);
            assert.ok(claim.id && claim.topic && claim.value && claim.summary && claim.sourceName,
                `${file}/${nodeId}: claim needs stable identity, topic, value, summary and source`);
            assert.equal(typeof claim.directObservation, "boolean",
                `${file}/${nodeId}: observation provenance must be explicit`);
            assert.ok(claim.circumstances,
                `${file}/${nodeId}: context and limitations must be documented`);
        }
    }
});

test("case 002 rumor retelling and firsthand testimony are not conflated", () => {
    const bartender = loadDialogue("assets/data/cases/case-002/dialogues/bartender_case2.js");
    const rumorRetelling = bartender.joe_challenges_visitor_overclaim.claim;
    assert.equal(rumorRetelling.directObservation, false);
    assert.deepEqual(Array.from(rumorRetelling.referencesRumorIds), ["detective-overstated-visitor-identity"]);
    assert.equal(bartender.kane_at_bar?.claim?.directObservation, true);

    const rival = loadDialogue("assets/data/cases/case-002/dialogues/rival.js");
    assert.equal(rival.caught_in_lie?.claim?.directObservation, true);
    assert.equal(rival.kane_formal_objection?.claim?.directObservation, true);

    const waiter = loadDialogue("assets/data/cases/case-002/dialogues/waiter.js");
    for (const nodeId of ["waiter_kane_at_poisoning", "protection_revision", "photo_observation_comparison"]) {
        const claim = waiter[nodeId]?.claim;
        if (claim) assert.equal(typeof claim.directObservation, "boolean");
    }
});
