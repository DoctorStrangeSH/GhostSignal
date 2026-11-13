import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createHarness(overrides = {}) {
    const names = { a: "Алекс", b: "Борис" };
    const context = vm.createContext({
        console, Date,
        getNPCById(id) { return names[id] ? { id, name: names[id] } : { id, name: id }; }
    });
    for (const path of [
        "assets/js/npc/npcMemoryService.js",
        "assets/js/npc/npcMotivationService.js",
        "assets/js/npc/npcSocialNetwork.js",
        "assets/js/npc/npcRelationshipService.js"
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }

    const clock = { day: 1, hour: 8, minute: 0 };
    const availability = {
        a: { available: true, location: "shared_room" },
        b: { available: true, location: "shared_room" }
    };
    const npcManager = { isNPCAvailable(id) { return availability[id] || { available: false, location: null }; } };
    const caseData = {
        id: "case-relationship-test",
        npcs: ["a", "b"],
        npcRelationships: {
            bonds: [
                { id: "a-b", fromNpcId: "a", toNpcId: "b", relationship: "colleagues", label: "Коллеги", trust: 60, reciprocal: true }
            ],
            autonomousInteractions: [
                {
                    id: "support-a-b", relationshipId: "a-b", fromNpcId: "a", toNpcId: "b",
                    interaction: "support", channel: "in_person", requiresSameLocation: true,
                    initialDelayMinutes: 30, everyMinutes: 60, minTrust: 50,
                    fromPressureBelow: 50, toPressureBelow: 70,
                    trustDelta: 2, reciprocalTrustDelta: 1,
                    summary: "Алекс поддержал Бориса."
                },
                {
                    id: "conflict-a-b", relationshipId: "a-b", fromNpcId: "a", toNpcId: "b",
                    interaction: "conflict", channel: "in_person", requiresSameLocation: true,
                    initialDelayMinutes: 30, everyMinutes: 60, fromPressureAtLeast: 50,
                    trustDelta: -20, reciprocalTrustDelta: -15,
                    summary: "Алекс сорвался на Бориса."
                },
                {
                    id: "reconcile-a-b", relationshipId: "a-b", fromNpcId: "a", toNpcId: "b",
                    interaction: "reconcile", channel: "in_person", requiresSameLocation: true,
                    initialDelayMinutes: 90, everyMinutes: 120, maxTrust: 45,
                    fromPressureBelow: 35, toPressureBelow: 35,
                    trustDelta: 10, reciprocalTrustDelta: 8,
                    summary: "Алекс попытался помириться с Борисом."
                }
            ]
        },
        ...overrides.caseData
    };
    context.clock = clock;
    context.availability = availability;
    context.npcManager = npcManager;
    context.caseData = caseData;
    const setup = vm.runInContext(
        "(() => { const memory = new NPCMemoryService(null, caseData.id); const network = new NPCSocialNetwork(null, memory, npcManager, clock); network.setCase(caseData); const relationships = new NPCRelationshipService(null, memory, npcManager, clock, network); relationships.setCase(caseData); network.setRelationshipService(relationships); return { memory, network, relationships }; })()",
        context
    );
    return {
        ...setup, context, clock, availability, caseData,
        advance(minutes) {
            clock.minute += minutes;
            while (clock.minute >= 60) { clock.minute -= 60; clock.hour++; }
            while (clock.hour >= 24) { clock.hour -= 24; clock.day++; }
            return setup.relationships.processDueInteractions();
        }
    };
}

test("NPCRelationshipService initializes authored bonds but hides them until evidence is found", () => {
    const { memory, relationships, network } = createHarness();
    assert.equal(memory.getRelationshipTrust("a", "b"), 60);
    assert.equal(memory.getRelationshipTrust("b", "a"), 60);
    assert.equal(relationships.getKnownRelationshipsForNPC("a").length, 0);
    assert.equal(network.getKnownEventLog(20).length, 0);

    const result = relationships.revealRelationships(["a-b"], {
        method: "observation", sourceId: "scene:shared-room"
    });
    assert.deepEqual(Array.from(result.revealed), ["a-b"]);
    assert.equal(relationships.isKnownRelationship("a-b"), true);
    assert.equal(relationships.getKnownRelationshipsForNPC("a")[0].name, "Борис");
    assert.equal(relationships.getKnownRelationshipsForNPC("a")[0].statusLabel, "Сдержанные отношения");
});

test("NPCRelationshipService runs autonomous support only when both NPCs can meet", () => {
    const { memory, relationships, network, availability, advance } = createHarness();
    availability.b.available = false;
    const deferred = advance(30);
    assert.equal(deferred.deferred >= 1, true);
    assert.equal(memory.getRelationshipTrust("a", "b"), 60);

    availability.b.available = true;
    const delivered = advance(15);
    assert.equal(delivered.changed, 1);
    assert.equal(memory.getRelationshipTrust("a", "b"), 62);
    assert.equal(memory.getRelationshipTrust("b", "a"), 61);
    assert.equal(network.getEventLog(10)[0].type, "relationship_support");
    assert.equal(network.getKnownEventLog(10).length, 0);
});

test("NPCRelationshipService can model conflict followed by reconciliation", () => {
    const relationshipConfig = {
        bonds: [{ id: "a-b", fromNpcId: "a", toNpcId: "b", relationship: "colleagues", label: "Коллеги", trust: 60, reciprocal: true }],
        autonomousInteractions: [
            {
                id: "conflict-a-b", relationshipId: "a-b", fromNpcId: "a", toNpcId: "b",
                interaction: "conflict", channel: "in_person", requiresSameLocation: true,
                initialDelayMinutes: 30, everyMinutes: 60, fromPressureAtLeast: 50,
                trustDelta: -20, reciprocalTrustDelta: -15, summary: "Алекс сорвался на Бориса."
            },
            {
                id: "reconcile-a-b", relationshipId: "a-b", fromNpcId: "a", toNpcId: "b",
                interaction: "reconcile", channel: "in_person", requiresSameLocation: true,
                initialDelayMinutes: 90, everyMinutes: 120, maxTrust: 45,
                fromPressureBelow: 35, toPressureBelow: 35,
                trustDelta: 10, reciprocalTrustDelta: 8, summary: "Алекс попытался помириться с Борисом."
            }
        ]
    };
    const { memory, relationships, advance } = createHarness({ caseData: { npcRelationships: relationshipConfig } });
    for (let i = 0; i < 5; i++) {
        memory.recordAnswerSelected("a", "pressure", "threat-" + i, { text: "Угроза.", tone: "threatening" });
    }
    assert.equal(memory.getPressure("a"), 60);

    advance(30);
    assert.equal(memory.getRelationshipTrust("a", "b"), 40);
    assert.equal(memory.getRelationshipTrust("b", "a"), 45);

    for (let i = 0; i < 10; i++) {
        memory.recordAnswerSelected("a", "pressure", "calm-" + i, { text: "Я сожалею.", tone: "reassuring" });
    }
    assert.equal(memory.getPressure("a"), 30);
    advance(60);
    assert.equal(memory.getRelationshipTrust("a", "b"), 50);
    assert.equal(memory.getRelationshipTrust("b", "a"), 53);
    assert.equal(relationships.toJSON().cases["case-relationship-test"].rules["reconcile-a-b"].occurrences, 1);
});

test("NPCRelationshipService persists autonomous schedules and confirmed dossier links", () => {
    const { relationships, memory, npcManager, clock, network } = createHarness();
    relationships.revealRelationships("a-b", { method: "document", sourceId: "document:letters" });
    const snapshot = relationships.toJSON();
    const context = vm.createContext({ console, Date, getNPCById(id) { return { id, name: id === "b" ? "Борис" : "Алекс" }; } });
    vm.runInContext(readFileSync(resolve(root, "assets/js/npc/npcRelationshipService.js"), "utf8"), context);
    context.snapshot = snapshot;
    context.memory = memory;
    context.npcManager = npcManager;
    context.clock = clock;
    context.network = network;
    const restored = vm.runInContext("NPCRelationshipService.fromJSON(snapshot, memory, npcManager, clock, network)", context);
    restored.setCase({ id: "case-relationship-test", npcs: ["a", "b"], npcRelationships: {
        bonds: [{ id: "a-b", fromNpcId: "a", toNpcId: "b", relationship: "colleagues", label: "Коллеги", trust: 60, reciprocal: true }],
        autonomousInteractions: []
    } });
    assert.equal(restored.isKnownRelationship("a-b"), true);
    assert.equal(restored.getKnownRelationshipsForNPC("a").length, 1);
});

test("case 001 and case 002 both use the shared relationship authoring schema", () => {
    const context = vm.createContext({});
    for (const [path, expression] of [
        ["assets/data/cases/case-001/index.js", "CASE_001"],
        ["assets/data/cases/case-002/index.js", "CASE_002"]
    ]) {
        const source = readFileSync(resolve(root, path), "utf8");
        vm.runInContext(source + "\n" + expression, context, { filename: path });
        const data = vm.runInContext(expression, context);
        assert.equal(Array.isArray(data.npcRelationships?.bonds), true, path);
        assert.equal(data.npcRelationships.bonds.length > 0, true, path);
        assert.equal(Array.isArray(data.npcRelationships?.autonomousInteractions), true, path);
        for (const rule of data.npcRelationships.autonomousInteractions) {
            assert.equal(data.npcRelationships.bonds.some(bond => bond.id === rule.relationshipId), true, rule.id);
        }
    }
});
