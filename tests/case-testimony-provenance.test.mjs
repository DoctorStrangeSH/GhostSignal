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
    return context.__dialogue;
}

function assertClaimNodesReachable(dialogue, label) {
    const nodes = dialogue.tree.nodes;
    const pending = [dialogue.tree.start,
        ...(Array.isArray(dialogue.tree.entryRules) ? dialogue.tree.entryRules.map(rule => rule.nodeId) : [])];
    const visited = new Set();
    while (pending.length) {
        const nodeId = pending.pop();
        if (!nodeId || visited.has(nodeId) || !nodes[nodeId]) continue;
        visited.add(nodeId);
        for (const answer of nodes[nodeId].answers || []) {
            if (answer.nextNode) pending.push(answer.nextNode);
        }
    }
    for (const [nodeId, node] of Object.entries(nodes)) {
        if (node.claim) {
            assert.ok(visited.has(nodeId), label + "/" + nodeId + ": testimony claim is unreachable from dialogue entry");
        }
    }
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
        const dialogue = loadDialogue(`assets/data/cases/case-001/dialogues/${file}`);
        const nodes = dialogue.tree.nodes;
        assertClaimNodesReachable(dialogue, "case-001/" + file);
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
    const bartenderDialogue = loadDialogue("assets/data/cases/case-002/dialogues/bartender_case2.js");
    assertClaimNodesReachable(bartenderDialogue, "case-002/bartender_case2.js");
    const bartender = bartenderDialogue.tree.nodes;
    const rumorRetelling = bartender.joe_challenges_visitor_overclaim.claim;
    assert.equal(rumorRetelling.directObservation, false);
    assert.deepEqual(Array.from(rumorRetelling.referencesRumorIds), ["detective-overstated-visitor-identity"]);
    assert.equal(bartender.returned_vial?.claim?.directObservation, true);

    const rivalDialogue = loadDialogue("assets/data/cases/case-002/dialogues/rival.js");
    assertClaimNodesReachable(rivalDialogue, "case-002/rival.js");
    const rival = rivalDialogue.tree.nodes;
    assert.equal(rival.confrontation?.claim?.directObservation, true);
    assert.equal(rival.partial_return?.claim?.directObservation, true);

    const waiterDialogue = loadDialogue("assets/data/cases/case-002/dialogues/waiter.js");
    assertClaimNodesReachable(waiterDialogue, "case-002/waiter.js");
    const waiter = waiterDialogue.tree.nodes;
    for (const nodeId of ["protection", "protection_revision", "testimony_reconsiders"]) {
        const claim = waiter[nodeId]?.claim;
        assert.ok(claim, `waiter/${nodeId}: testimony revision must remain linked to its source claim`);
        assert.equal(claim.directObservation, true);
    }
});
