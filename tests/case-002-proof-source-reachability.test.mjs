import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadScenario() {
    const registry = {};
    const ctx = vm.createContext({
        console: { log() {} },
        registerData(type, data) {
            registry[type] = { ...(registry[type] || {}), ...data };
        }
    });
    for (const path of [
        'assets/data/cases/case-002/index.js',
        'assets/data/cases/case-002/locations.js',
        'assets/data/cases/case-002/objects.js',
        'assets/data/cases/case-002/dialogues/journalist.js',
        'assets/data/cases/case-002/dialogues/rival.js'
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), 'utf8'), ctx, { filename: path });
    }
    return {
        caseData: vm.runInContext('CASE_002', ctx),
        journalist: vm.runInContext('DIALOGUE_JOURNALIST', ctx),
        rival: vm.runInContext('DIALOGUE_RIVAL_FULL', ctx),
        ...registry
    };
}

function reachableNode(tree, start, target) {
    const visited = new Set();
    const queue = [start];
    while (queue.length) {
        const id = queue.shift();
        if (id === target) return true;
        if (visited.has(id)) continue;
        visited.add(id);
        for (const answer of tree.nodes[id]?.answers || []) {
            // This is an unconditional route: it survives reputation/rumor gates.
            if (!answer.condition && answer.nextNode) queue.push(answer.nextNode);
        }
    }
    return false;
}

test('case two required physical exhibits are acquirable from public locations', () => {
    const { caseData, location, object } = loadScenario();
    for (const itemId of caseData.proofRequirements.requiredItems) {
        const source = Object.values(object).find(obj =>
            obj.interactions?.examine?.spawnsItem === itemId
        );
        assert.ok(source, `No source for ${itemId}`);
        const accessible = caseData.locations.some(locId => {
            const loc = location[locId];
            return loc?.unlockedByDefault === true &&
                loc?.type === 'public' &&
                loc.defaultItems?.includes(source.id) &&
                loc.hours?.open < loc.hours?.close;
        });
        assert.equal(accessible, true, `${itemId} source must be in an openable public location`);
        assert.equal(object[itemId]?.isEvidence, true);
        assert.equal(object[itemId]?.takeable, true);
    }
});

test('Lora offers an unconditional documentary path even after the rumor followup', () => {
    const { caseData, journalist, location } = loadScenario();
    assert.ok(caseData.proofRequirements.anyInsights.includes('hard_evidence_kane'));
    assert.equal(location.newspaper_office.unlockedByDefault, true);
    assert.equal(journalist.tree.nodes.show_evidence.givesInsight, 'hard_evidence_kane');

    assert.equal(reachableNode(journalist.tree, journalist.tree.start, 'show_evidence'), true);
    const pressuredEntry = journalist.tree.entryRules.find(rule =>
        rule.nodeId === 'lora_second_check_opening'
    );
    assert.ok(pressuredEntry);
    assert.equal(reachableNode(journalist.tree, pressuredEntry.nodeId, 'show_evidence'), true);
});

test('a formal confession is an alternative to Lora, not the only viable route', () => {
    const { caseData, rival } = loadScenario();
    assert.ok(caseData.proofRequirements.anyInsights.includes('full_confession_kane'));
    const confession = rival.tree.nodes.formal_confession;
    assert.equal(confession.givesInsight, 'full_confession_kane');
    assert.ok(caseData.proofRequirements.anyInsights.includes('hard_evidence_kane'));
});
