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
        console, Date, events: { emit() {} },
        getNPCById(id) {
            return {
                id, name: names[id] || id,
                schedule: { sleeps: null, awake: null, atWork: null, locations: { home: "shared_room", work: "shared_room" } },
                availableForCall: true, availableForChat: true, mood: "neutral", description: ""
            };
        }
    });
    for (const path of [
        "assets/js/npc/npcMemoryService.js",
        "assets/js/npc/npcMotivationService.js",
        "assets/js/npc/npcSocialNetwork.js",
        "assets/js/npc/npcRelationshipService.js",
        "assets/js/npc/npcManager.js"
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
        "(() => { const memory = new NPCMemoryService(null, caseData.id); const motivations = new NPCMotivationService(memory); const network = new NPCSocialNetwork(null, memory, npcManager, clock); network.setMotivationService(motivations); network.setCase(caseData); const relationships = new NPCRelationshipService(null, memory, npcManager, clock, network); relationships.setCase(caseData); network.setRelationshipService(relationships); return { memory, motivations, network, relationships }; })()",
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
    assert.equal(relationships.getKnownRelationshipsForNPC("a")[0].statusLabel, "Хорошие отношения");
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

test("social rumor delivery strengthens the relationship between NPCs who share information", () => {
    const caseData = {
        id: "case-relationship-test",
        npcs: ["a", "b"],
        socialNetwork: {
            maxHops: 1, retryMinutes: 15, expiryMinutes: 120,
            edges: [{ id: "a-to-b", from: "a", to: "b", relationship: "colleagues", label: "Коллеги", trust: 60, channel: "message", delayMinutes: 1, minTrustToShare: 0, shareTypes: ["detective_behavior"] }]
        },
        npcRelationships: {
            bonds: [{ id: "a-b", fromNpcId: "a", toNpcId: "b", relationship: "colleagues", label: "Коллеги", trust: 60, reciprocal: true }],
            autonomousInteractions: []
        }
    };
    const { memory, network, clock } = createHarness({ caseData });
    const sourceEvent = { dialogueId: "dialogue-a", nodeId: "report", answerText: "Я поделюсь этим.", tone: "neutral" };
    memory.recordAnswerSelected("a", sourceEvent.dialogueId, sourceEvent.nodeId, { text: sourceEvent.answerText, tone: "neutral" });
    const published = network.publish("a", {
        id: "shared-fact", kind: "detective_behavior", sourceName: "Алекс", text: "Детектив приходил к Борису."
    }, sourceEvent);
    assert.equal(published.queued, 1);
    clock.minute += 1;
    const result = network.processDueDeliveries();
    assert.equal(result.delivered, 1);
    assert.equal(memory.getRelationshipTrust("a", "b"), 61);
    assert.equal(network.getEventLog(10).some(item => item.type === "relationship_support"), true);
    assert.equal(network.getKnownEventLog(10).length, 0);
});

test("breaking a loyalty bond lowers trust with the protected NPC", () => {
    const caseData = {
        id: "case-relationship-test",
        npcs: ["a", "b", "c"],
        npcMotivations: {
            a: {
                motives: [{ id: "protect_c", weight: 100, pressureResistance: 0 }],
                loyalties: [{ npcId: "c", strength: 90, protectThreshold: 60, appliesTo: ["detective_behavior"], motiveId: "protect_c" }]
            }
        },
        socialNetwork: {
            maxHops: 1, retryMinutes: 15, expiryMinutes: 120,
            edges: [{ id: "a-to-b", from: "a", to: "b", relationship: "source", label: "Источник", trust: 70, channel: "message", delayMinutes: 1, minTrustToShare: 0, shareTypes: ["detective_behavior"] }]
        },
        npcRelationships: {
            bonds: [{ id: "a-c", fromNpcId: "a", toNpcId: "c", relationship: "protective", label: "Защитная связь", trust: 80, reciprocal: true }],
            autonomousInteractions: []
        }
    };
    const { memory, network } = createHarness({ caseData });
    const sourceEvent = { dialogueId: "dialogue-a", nodeId: "betrayal", answerText: "Я больше не буду молчать.", tone: "threatening" };
    for (let i = 0; i < 8; i++) {
        memory.recordAnswerSelected("a", sourceEvent.dialogueId, i === 7 ? sourceEvent.nodeId : "pressure-" + i, {
            text: sourceEvent.answerText, tone: "threatening"
        });
    }
    const result = network.publish("a", {
        id: "betrayal-report", kind: "detective_behavior", sourceName: "Алекс",
        targetNpcId: "c", text: "Алекс раскрыл секрет Бориса."
    }, sourceEvent);
    assert.equal(result.published, true);
    assert.equal(memory.getRelationshipTrust("a", "c"), 60);
    assert.equal(network.getEventLog(10).some(item => item.type === "relationship_conflict"), true);
});

test("NPCManager dossier data excludes NPC-only rumors and private trust maps", () => {
    const { memory, relationships, network, clock, context } = createHarness();
    memory.setRelationshipTrust("a", "b", 77);
    context.memory = memory;
    context.relationships = relationships;
    context.network = network;
    const manager = vm.runInContext("(() => { const value = new NPCManager(clock, null); value.activeNPCs = [getNPCById('a')]; value.setMemoryService(memory); value.setSocialNetwork(network); value.setRelationshipService(relationships); return value; })()", context);
    const status = manager.getNPCStatus("a");
    assert.equal(status.memory.relationshipTrusts, undefined);
    assert.equal(status.memory.rumors, undefined);
    assert.equal(status.relationships.length, 0);
    relationships.revealRelationships("a-b", { method: "dialogue", sourceId: "dialogue-a:identity" });
    assert.equal(manager.getNPCStatus("a").relationships.length, 1);
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
