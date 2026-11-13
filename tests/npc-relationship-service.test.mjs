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

test("NPCRelationshipService support events rebuild cooperation and persist without replay", () => {
    const relationshipConfig = {
        bonds: [{
            id: "a-b", fromNpcId: "a", toNpcId: "b",
            relationship: "colleagues", label: "Коллеги", trust: 60, reciprocal: true
        }],
        autonomousInteractions: [{
            id: "support-cooperation", relationshipId: "a-b",
            fromNpcId: "a", toNpcId: "b", interaction: "support",
            channel: "in_person", requiresSameLocation: true,
            initialDelayMinutes: 30, everyMinutes: 60, maxOccurrences: 1,
            trustDelta: 1, reciprocalTrustDelta: 1, toCooperationDelta: 14,
            summary: "Алекс поддержал Бориса перед важным разговором."
        }]
    };
    const { memory, relationships, advance, context } = createHarness({
        caseData: { npcRelationships: relationshipConfig }
    });
    advance(30);
    assert.equal(memory.getMemory("b").cooperation, 64);
    assert.equal(memory.getCooperationState("b").score, 64);
    advance(120);
    assert.equal(memory.getMemory("b").cooperation, 64);
    assert.equal(relationships.toJSON().cases["case-relationship-test"].rules["support-cooperation"].occurrences, 1);

    context.snapshot = memory.toJSON();
    const restored = vm.runInContext(
        "NPCMemoryService.fromJSON(snapshot, 'case-relationship-test')",
        context
    );
    assert.equal(restored.getMemory("b").cooperation, 64);
    assert.equal(restored.getMemory("b").cooperationHistory.length, 1);
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
    const { memory, motivations, network, relationships } = createHarness({ caseData });
    const sourceEvent = { dialogueId: "dialogue-a", nodeId: "betrayal", answerText: "Я больше не буду молчать.", tone: "threatening" };
    for (let i = 0; i < 8; i++) {
        memory.recordAnswerSelected("a", sourceEvent.dialogueId, i === 7 ? sourceEvent.nodeId : "pressure-" + i, {
            text: sourceEvent.answerText, tone: "threatening"
        });
    }
    const loyalty = motivations.getEffectiveLoyalty("a", "c");
    assert.equal(loyalty?.score, 0);
    assert.equal(loyalty?.protects, false);
    const decision = motivations.evaluateDisclosure("a", { kind: "detective_behavior", targetNpcId: "c" }, { to: "b" });
    assert.equal(decision.reason, "loyalty_broken");
    const result = network.publish("a", {
        id: "betrayal-report", kind: "detective_behavior", sourceName: "Алекс",
        targetNpcId: "c", text: "Алекс раскрыл секрет Бориса."
    }, sourceEvent);
    assert.equal(result.published, true);
    assert.equal(network.getEventLog(10).some(item => item.type === "betrayal"), true);
    assert.equal(memory.getRelationshipTrust("a", "c"), 60);
    assert.equal(memory.getRelationshipTrust("c", "a"), 60);
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
    assert.equal(status.memory.cooperation, undefined);
    assert.equal(status.memory.cooperationHistory, undefined);
    assert.equal(status.psychology.cooperation.state, "guarded");
    assert.equal(status.relationships.length, 0);
    relationships.revealRelationships("a-b", { method: "dialogue", sourceId: "dialogue-a:identity" });
    assert.equal(manager.getNPCStatus("a").relationships.length, 1);
});

test("NPCRelationshipService carries NPC-to-NPC trust across case boundaries and saves", () => {
    const { memory, relationships, npcManager, clock, network, advance } = createHarness();
    advance(30);
    assert.equal(memory.getRelationshipTrust("a", "b"), 62);
    assert.equal(memory.getRelationshipTrust("b", "a"), 61);

    const nextCase = {
        id: "case-relationship-followup",
        npcs: ["a", "b"],
        npcRelationships: {
            bonds: [{
                id: "a-b-followup", fromNpcId: "a", toNpcId: "b",
                relationship: "old_colleagues", label: "Старые коллеги",
                trust: 10, reciprocal: true
            }],
            autonomousInteractions: []
        }
    };
    memory.setCase(nextCase.id);
    relationships.setCase(nextCase);
    assert.equal(memory.getRelationshipTrust("a", "b"), 62);
    assert.equal(memory.getRelationshipTrust("b", "a"), 61);

    const snapshot = relationships.toJSON();
    assert.equal(snapshot.worldTrusts.a.b, 62);
    const restored = vm.runInContext(
        "NPCRelationshipService.fromJSON(snapshot, memory, npcManager, clock, network)",
        contextForRestore()
    );
    function contextForRestore() {
        const context = vm.createContext({ console, Date });
        vm.runInContext(readFileSync(resolve(root, "assets/js/npc/npcRelationshipService.js"), "utf8"), context);
        context.snapshot = snapshot;
        context.memory = memory;
        context.npcManager = npcManager;
        context.clock = clock;
        context.network = network;
        return context;
    }
    memory.setCase("case-relationship-third");
    restored.setDependencies(memory, npcManager, clock, network);
    restored.setCase({
        id: "case-relationship-third",
        npcs: ["a", "b"],
        npcRelationships: {
            bonds: [{
                id: "a-b-third", fromNpcId: "a", toNpcId: "b",
                relationship: "old_colleagues", label: "Старые коллеги",
                trust: 5, reciprocal: true
            }],
            autonomousInteractions: []
        }
    });
    assert.equal(memory.getRelationshipTrust("a", "b"), 62);
    assert.equal(memory.getRelationshipTrust("b", "a"), 61);
});

test("NPCRelationshipService upgrades v2 saves without discarding relationship history", () => {
    const { memory, network, clock } = createHarness();
    const legacy = vm.runInContext(
        "NPCRelationshipService.fromJSON({ version: 2, currentCaseId: 'case-relationship-test', cases: {}, worldTrusts: { a: { b: 64 } } }, memory, npcManager, clock, network)",
        (() => {
            const context = vm.createContext({ console, Date });
            vm.runInContext(readFileSync(resolve(root, "assets/js/npc/npcRelationshipService.js"), "utf8"), context);
            Object.assign(context, {
                memory, network, clock,
                npcManager: { isNPCAvailable() { return { available: true, location: "shared_room" }; } }
            });
            return context;
        })()
    );
    assert.equal(legacy.toJSON().version, 3);
    assert.equal(legacy.toJSON().worldTrusts.a.b, 64);
    assert.equal(Object.keys(legacy.toJSON().worldGoals).length, 0);
});

test("NPCRelationshipService advances and persists personal goals across investigations", () => {
    const { memory, relationships, advance, caseData, network } = createHarness();
    const goalConfig = {
        goals: [{
            id: "keep_community_together", npcId: "a",
            title: "Сохранить сообщество", description: "Не потерять близких людей.",
            priority: 80, target: 2
        }],
        bonds: caseData.npcRelationships.bonds,
        autonomousInteractions: [{
            id: "support-a-b", relationshipId: "a-b", fromNpcId: "a", toNpcId: "b",
            interaction: "support", channel: "phone", initialDelayMinutes: 30,
            everyMinutes: 60, maxOccurrences: 1, trustDelta: 1, reciprocalTrustDelta: 1,
            goalId: "keep_community_together", goalProgress: 1,
            summary: "Алекс позвонил Борису."
        }]
    };
    const firstCase = { ...caseData, npcRelationships: goalConfig };
    relationships.setCase(firstCase);
    advance(30);
    assert.equal(relationships.getGoalProgress("a", "keep_community_together"), 1);
    assert.equal(relationships.isGoalCompleted("a", "keep_community_together"), false);

    const nextCase = {
        id: "case-goal-followup", npcs: ["a", "b"],
        npcRelationships: {
            goals: [{ id: "keep_community_together", npcId: "a", title: "Сохранить сообщество", description: "Продолжить поддерживать близких.", priority: 80, target: 2 }],
            bonds: [{ id: "a-b-followup", fromNpcId: "a", toNpcId: "b", relationship: "colleagues", label: "Коллеги", trust: 10, reciprocal: true }],
            autonomousInteractions: [{
                id: "support-followup", relationshipId: "a-b-followup", fromNpcId: "a", toNpcId: "b",
                interaction: "support", channel: "phone", initialDelayMinutes: 30,
                everyMinutes: 60, maxOccurrences: 1, trustDelta: 1, reciprocalTrustDelta: 1,
                goalId: "keep_community_together", goalProgress: 1,
                summary: "Алекс снова поддержал Бориса."
            }]
        }
    };
    memory.setCase(nextCase.id);
    relationships.setCase(nextCase);
    assert.equal(relationships.getGoalProgress("a", "keep_community_together"), 1);
    assert.equal(relationships.getPersonalGoals("a")[0].status, "active");
    advance(30);
    assert.equal(relationships.getGoalProgress("a", "keep_community_together"), 2);
    assert.equal(relationships.isGoalCompleted("a", "keep_community_together"), true);
    advance(120);
    assert.equal(relationships.getGoalProgress("a", "keep_community_together"), 2);

    const snapshot = relationships.toJSON();
    assert.equal(snapshot.version, 3);
    assert.equal(snapshot.worldGoals.a.keep_community_together.history.length, 2);
    const restored = vm.runInContext(
        "NPCRelationshipService.fromJSON(snapshot, memory, npcManager, clock, network)",
        contextForRestore()
    );
    assert.equal(restored.isGoalCompleted("a", "keep_community_together"), true);
    assert.equal(restored.getPersonalGoals("a")[0].progress, 2);

    function contextForRestore() {
        const context = vm.createContext({ console, Date });
        vm.runInContext(readFileSync(resolve(root, "assets/js/npc/npcRelationshipService.js"), "utf8"), context);
        Object.assign(context, { snapshot, memory, npcManager: { isNPCAvailable() { return { available: true, location: "shared_room" }; } }, clock: { day: 1, hour: 9, minute: 0 }, network });
        return context;
    }
});

test("NPCRelationshipService gates autonomous actions on persistent goal progress", () => {
    const { relationships, advance, caseData } = createHarness();
    const nextCase = {
        ...caseData,
        npcRelationships: {
            goals: [{ id: "protect_partner", npcId: "a", title: "Защитить партнёра", target: 2 }],
            bonds: caseData.npcRelationships.bonds,
            autonomousInteractions: [{
                id: "goal-gated-support", relationshipId: "a-b", fromNpcId: "a", toNpcId: "b",
                interaction: "support", channel: "phone", initialDelayMinutes: 30,
                everyMinutes: 60, maxOccurrences: 1, minTrust: 0,
                goalId: "protect_partner", goalNpcId: "a", goalProgress: 1,
                conditions: { requiresGoalId: "protect_partner", requiresGoalNpcId: "a", requiresGoalProgressAtLeast: 1 },
                summary: "Алекс поддержал Бориса только после того, как решил защитить его."
            }]
        }
    };
    relationships.setCase(nextCase);
    const before = advance(30);
    assert.equal(before.changed, 0);
    assert.equal(relationships.getGoalProgress("a", "protect_partner"), 0);
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
        assert.equal(Array.isArray(data.npcRelationships?.goals), true, path);
        assert.equal(data.npcRelationships.goals.length > 0, true, path);
        assert.equal(data.npcRelationships.bonds.some(bond => bond.id === "bartender-sergeant"), true, path);
        for (const goal of data.npcRelationships.goals) {
            assert.equal(data.npcs.includes(goal.npcId), true, goal.id);
            assert.equal(Number.isInteger(goal.target) && goal.target > 0, true, goal.id);
        }
        for (const rule of data.npcRelationships.autonomousInteractions) {
            assert.equal(data.npcRelationships.bonds.some(bond => bond.id === rule.relationshipId), true, rule.id);
            if (rule.goalId) {
                const owner = rule.goalNpcId || rule.fromNpcId;
                assert.equal(data.npcRelationships.goals.some(goal => goal.id === rule.goalId && goal.npcId === owner), true, rule.id);
            }
        }
    }
});

test("autonomous actions wait for a rumor personally received by the acting NPC", () => {
    const rule = {
        id: "rumor-driven-support", relationshipId: "a-b",
        fromNpcId: "a", toNpcId: "b", interaction: "support", channel: "message",
        initialDelayMinutes: 30, everyMinutes: 30, maxOccurrences: 1,
        fromRumorId: "detective-threatened-b", fromRumorConfidenceAtLeast: 55,
        trustDelta: 4, reciprocalTrustDelta: 2, summary: "Алекс поддержал Бориса, узнав об угрозе."
    };
    const config = {
        bonds: [{ id: "a-b", fromNpcId: "a", toNpcId: "b", relationship: "friends", trust: 60, reciprocal: true }],
        autonomousInteractions: [rule]
    };
    const { memory, relationships, advance, context } = createHarness({ caseData: { npcRelationships: config } });
    assert.equal(advance(30).changed, 0);
    assert.equal(memory.getRelationshipTrust("a", "b"), 60);

    const transmission = {
        fromNpcId: "b", originalSourceNpcId: "b",
        sourceEvent: { dialogueId: "dialogue-b", nodeId: "threat", answerText: "Мне угрожали." },
        recipientTrust: 80, path: ["b", "a"], hops: 1
    };
    const report = { id: "detective-threatened-b", kind: "detective_behavior", text: "Детектив угрожал Борису." };

    // Hearing the same rumor only in B's memory cannot trigger A's private decision.
    assert.equal(memory.receiveSocialRumor("b", report, transmission).received, true);
    assert.equal(advance(30).changed, 0);
    assert.equal(memory.receiveSocialRumor("a", report, transmission).received, true);
    assert.equal(advance(30).changed, 1);
    assert.equal(memory.getRelationshipTrust("a", "b"), 64);
    assert.equal(advance(60).changed, 0);

    context.savedRelationships = relationships.toJSON();
    context.memory = memory;
    const restored = vm.runInContext(
        "NPCRelationshipService.fromJSON(savedRelationships, memory, npcManager, clock)",
        context
    );
    restored.setCase({ ...context.caseData, npcRelationships: config });
    assert.equal(restored.processDueInteractions().changed, 0);
    assert.equal(restored.toJSON().cases["case-relationship-test"].rules["rumor-driven-support"].occurrences, 1);
});

test("rumor-driven actions can demand corroboration rather than treating gossip as fact", () => {
    const config = {
        bonds: [{ id: "a-b", fromNpcId: "a", toNpcId: "b", trust: 60, reciprocal: true }],
        autonomousInteractions: [{
            id: "verified-action", relationshipId: "a-b", fromNpcId: "a", toNpcId: "b",
            interaction: "support", channel: "message", initialDelayMinutes: 30, everyMinutes: 30,
            maxOccurrences: 1, fromRumorId: "witness-report", fromRumorStatus: "corroborated",
            trustDelta: 3, summary: "Алекс действует только после проверки."
        }]
    };
    const { memory, advance } = createHarness({ caseData: { npcRelationships: config } });
    assert.equal(memory.receiveSocialRumor("a", {
        id: "witness-report", kind: "detective_behavior", text: "Сообщение свидетеля."
    }, {
        fromNpcId: "b", originalSourceNpcId: "b", recipientTrust: 80, hops: 1,
        sourceEvent: { dialogueId: "b", nodeId: "1", answerText: "Я видел." }
    }).received, true);
    assert.equal(advance(30).changed, 0);
    // A rumor cannot self-certify: the witness must have a recorded direct observation.
    assert.equal(memory.corroborateRumor("a", "witness-report", "b", "absent").corroborated, false);
    assert.equal(advance(30).changed, 0);
});

test("completed autonomous actions are visible only to their actual initiator and survive loading", () => {
    const { relationships, advance, context, memory, npcManager, clock, caseData } = createHarness();
    assert.equal(relationships.hasCompletedInteraction("a", "support-a-b"), false);
    assert.equal(relationships.hasCompletedInteraction("b", "support-a-b"), false);
    advance(30);
    assert.equal(relationships.hasCompletedInteraction("a", "support-a-b"), true);
    assert.equal(relationships.hasCompletedInteraction("b", "support-a-b"), false);
    assert.equal(relationships.hasCompletedInteraction("a", "nonexistent"), false);

    context.savedRelationships = relationships.toJSON();
    context.memory = memory;
    const loaded = vm.runInContext("NPCRelationshipService.fromJSON(savedRelationships, memory, npcManager, clock)", context);
    loaded.setCase(caseData);
    assert.equal(loaded.hasCompletedInteraction("a", "support-a-b"), true);
});
