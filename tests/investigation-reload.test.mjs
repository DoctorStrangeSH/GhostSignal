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

test('a promise stays pending after reload, then resolves only once when evidence arrives', () => {
    const { NPCMemoryService, SaveController } = loadSystems();
    const memory = new NPCMemoryService(null, 'case-002');
    const promise = {
        id: 'protect-family', text: 'I will make your family safe',
        fulfillment: { type: 'insight_gained', insightId: 'family_protected' },
        fulfilledTrustDelta: 7, brokenTrustDelta: -9
    };
    assert.equal(memory.recordPromise('waiter', promise).recorded, true);
    let saved;
    const app = { progress: { activeCase: 'case-002' }, npcMemoryService: memory };
    const controller = new SaveController(app, { saveProgress(value) { saved = clone(value); return true; } });
    assert.equal(controller.quickSave(), true);

    const restored = NPCMemoryService.fromJSON(saved.npcMemoryData, saved.activeCase);
    assert.equal(restored.getPromises('waiter')[0].status, 'pending');
    assert.equal(restored.recordPromise('waiter', promise).reason, 'already_recorded');
    const trustBefore = restored.getMemory('waiter').trust;
    assert.equal(restored.resolvePromisesForEvent({ type: 'insight_gained', insightId: 'wrong_insight' }).length, 0);
    assert.equal(restored.resolvePromisesForEvent({ type: 'insight_gained', insightId: 'family_protected' }).length, 1);
    assert.equal(restored.getMemory('waiter').trust, trustBefore + 7);

    const completed = NPCMemoryService.fromJSON(clone(restored.toJSON()), 'case-002');
    assert.equal(completed.getPromises('waiter')[0].status, 'fulfilled');
    assert.equal(completed.resolvePromisesForEvent({ type: 'insight_gained', insightId: 'family_protected' }).length, 0);
    assert.equal(completed.settlePromisesForCase('case-002', 'solved').length, 0);
    assert.equal(completed.getMemory('waiter').trust, trustBefore + 7);
});

test('breaking a promise persists its consequence across reloads without double penalty', () => {
    const { NPCMemoryService } = loadSystems();
    const memory = new NPCMemoryService(null, 'case-002');
    assert.equal(memory.recordPromise('waiter', {
        id: 'bring-evidence', text: 'I will bring you evidence',
        fulfillment: { type: 'item_acquired', itemId: 'sealed_letter' },
        brokenTrustDelta: -8
    }).recorded, true);
    const before = memory.getMemory('waiter').trust;
    assert.equal(memory.settlePromisesForCase('case-002', 'failed').length, 1);
    const restored = NPCMemoryService.fromJSON(clone(memory.toJSON()), 'case-002');
    assert.equal(restored.getPromises('waiter')[0].status, 'broken');
    assert.equal(restored.getMemory('waiter').trust, before - 8);
    assert.equal(restored.settlePromisesForCase('case-002', 'failed').length, 0);
    assert.equal(restored.getMemory('waiter').trust, before - 8);
    assert.ok(restored.people.waiter.memories.some(entry => entry.type === 'promise_broken'));
});
