import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = [
    'assets/js/npc/npcMemoryService.js',
    'assets/js/npc/npcSocialNetwork.js',
    'assets/js/npc/npcRelationshipService.js',
    'assets/js/systems/board.js',
    'assets/js/controllers/saveController.js'
];

function loadSystems() {
    const context = vm.createContext({
        console,
        events: { emit() {} },
        getObjectById() { return null; }
    });
    for (const path of scripts) {
        vm.runInContext(readFileSync(resolve(root, path), 'utf8'), context, { filename: path });
    }
    return vm.runInContext('({ NPCMemoryService, NPCSocialNetwork, NPCRelationshipService, InvestigationBoard, SaveController })', context);
}

const clone = value => JSON.parse(JSON.stringify(value));

test('investigation NPC claims, rumors, relationships and hypotheses survive a save/reload cycle', () => {
    const { NPCMemoryService, NPCSocialNetwork, NPCRelationshipService, InvestigationBoard, SaveController } = loadSystems();
    const memory = new NPCMemoryService(null, 'case-002');
    const claim = memory.recordClaim('waiter', {
        id: 'thomas-window', topic: 'suspect-route', value: 'North exit',
        summary: 'Thomas saw someone use the north exit', directObservation: true
    });
    assert.equal(claim.added, true);

    const transmission = {
        fromNpcId: 'joe', originalSourceNpcId: 'joe',
        sourceEvent: { dialogueId: 'joe-call', nodeId: 'warning', answerText: 'Watch the exit' },
        path: ['joe', 'waiter'], hops: 1, channel: 'call'
    };
    const report = { id: 'rumor-exit', kind: 'detective_behavior', text: 'The detective asked about the exit' };
    assert.equal(memory.receiveSocialRumor('waiter', report, transmission).received, true);

    const social = new NPCSocialNetwork({
        currentCaseId: 'case-002',
        cases: { 'case-002': { pendingDeliveries: [{ id: 'delivery-1', rumorId: 'rumor-exit' }] } }
    }, memory);
    const relationships = new NPCRelationshipService({
        currentCaseId: 'case-002',
        cases: { 'case-002': { journal: [{ type: 'interview', npcId: 'waiter' }] } },
        worldTrusts: { joe: { waiter: 73 } },
        worldGoals: { waiter: { ambition: 'protect-family' } }
    }, memory, null, null, social);

    const board = new InvestigationBoard();
    board.setCase('case-002');
    const hypothesisId = board.addHypothesis('The witness mistook the exit');
    assert.equal(board.linkHypothesis(hypothesisId, 'statement', 'thomas-window', 'against'), true);

    const progress = { activeCase: 'case-002' };
    let stored = null;
    const storage = { saveProgress(value) { stored = clone(value); return true; } };
    const controller = new SaveController({ progress, npcMemoryService: memory, npcSocialNetwork: social,
        npcRelationshipService: relationships, investigationBoard: board }, storage);
    assert.equal(controller.quickSave(), true);

    const reloaded = clone(stored);
    const restoredMemory = NPCMemoryService.fromJSON(reloaded.npcMemoryData, reloaded.activeCase);
    const restoredSocial = NPCSocialNetwork.fromJSON(reloaded.npcSocialData, restoredMemory);
    const restoredRelationships = NPCRelationshipService.fromJSON(
        reloaded.npcRelationshipData, restoredMemory, null, null, restoredSocial
    );
    const restoredBoard = InvestigationBoard.fromJSON(reloaded.boardData);
    restoredBoard.setCase(reloaded.activeCase, true);

    assert.deepEqual(clone(restoredMemory.toJSON()), clone(memory.toJSON()));
    assert.deepEqual(clone(restoredSocial.toJSON()), clone(social.toJSON()));
    assert.deepEqual(clone(restoredRelationships.toJSON()), clone(relationships.toJSON()));
    assert.deepEqual(clone(restoredBoard.toJSON()), clone(board.toJSON()));

    assert.equal(restoredMemory.getRumors('waiter').length, 1);
    assert.equal(restoredMemory.receiveSocialRumor('waiter', report, transmission).reason, 'already_received');
    assert.equal(restoredBoard.hypotheses[0].links[0].sourceId, 'thomas-window');
    assert.equal(restoredRelationships.worldTrusts.joe.waiter, 73);
});
