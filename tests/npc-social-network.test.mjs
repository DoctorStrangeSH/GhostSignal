import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createHarness() {
    const npcNames = {
        waiter: { name: "Томас", availableForCall: false },
        bartender: { name: "Джо", availableForCall: true },
        journalist: { name: "Лора", availableForCall: true },
        ex_wife: { name: "Анна", availableForCall: true },
        woman_in_red: { name: "Ева", availableForCall: false }
    };
    const context = vm.createContext({ console, Date, getNPCById(id) { return npcNames[id] || null; } });
    for (const path of ["assets/js/npc/npcMemoryService.js", "assets/js/npc/npcSocialNetwork.js"]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }
    const clock = { day: 1, hour: 18, minute: 0 };
    const availability = {
        waiter: { available: true, location: "bar_joe" },
        bartender: { available: true, location: "bar_joe" },
        journalist: { available: true, location: "newspaper_office" },
        ex_wife: { available: true, location: "anna_apartment" },
        woman_in_red: { available: true, location: "bar_joe" }
    };
    const npcManager = { isNPCAvailable(id) { return availability[id] || { available: false, location: null }; } };
    const caseData = {
        id: "case-002",
        npcs: ["waiter", "bartender", "journalist", "ex_wife", "woman_in_red"],
        socialNetwork: {
            maxHops: 2, retryMinutes: 15, expiryMinutes: 240,
            edges: [
                { id: "waiter-joe", from: "waiter", to: "bartender", relationship: "coworkers", label: "Коллеги", trust: 80, channel: "in_person", delayMinutes: 15, minTrustToShare: 35, shareTypes: ["detective_behavior"], canForward: true },
                { id: "joe-press", from: "bartender", to: "journalist", relationship: "source", label: "Источник в баре", trust: 65, channel: "message", delayMinutes: 30, minTrustToShare: 50, shareTypes: ["detective_behavior"], canForward: true },
                { id: "eva-press", from: "woman_in_red", to: "journalist", relationship: "protective", label: "Защищает сестру", trust: 70, channel: "message", delayMinutes: 20, minTrustToShare: 30, shareTypes: ["detective_behavior"], protectsNpcIds: ["ex_wife"], withholdIfTargetProtected: true },
                { id: "eva-anna", from: "woman_in_red", to: "ex_wife", relationship: "siblings", label: "Сёстры", trust: 95, channel: "phone", delayMinutes: 10, minTrustToShare: 20, shareTypes: ["detective_behavior"], canForward: true },
                { id: "anna-eva", from: "ex_wife", to: "woman_in_red", relationship: "siblings", label: "Сёстры", trust: 95, channel: "phone", delayMinutes: 10, minTrustToShare: 20, shareTypes: ["detective_behavior"] }
            ]
        }
    };
    context.clock = clock;
    context.availability = availability;
    context.npcManager = npcManager;
    context.caseData = caseData;
    const setup = vm.runInContext("(() => { const memory = new NPCMemoryService(null, 'case-002'); const network = new NPCSocialNetwork(null, memory, npcManager, clock); network.setCase(caseData); return { memory, network }; })()", context);
    return {
        ...setup, context, clock, availability,
        advance(minutes) {
            clock.minute += minutes;
            while (clock.minute >= 60) { clock.minute -= 60; clock.hour++; }
            while (clock.hour >= 24) { clock.hour -= 24; clock.day++; }
            return setup.network.processDueDeliveries();
        }
    };
}

function publish(memory, network, report = {}) {
    const sourceEvent = { dialogueId: "dialogue-waiter", nodeId: "greeting", answerText: "Я видел это.", tone: "aggressive" };
    memory.recordAnswerSelected("waiter", sourceEvent.dialogueId, sourceEvent.nodeId, { text: sourceEvent.answerText, tone: sourceEvent.tone });
    return network.publish("waiter", {
        id: "social-test-report", kind: "detective_behavior", sourceName: "Томас",
        text: "Детектив пригрозил свидетелю.", ...report
    }, sourceEvent);
}

test("NPCSocialNetwork schedules attributed rumors instead of revealing them immediately", () => {
    const { memory, network, advance } = createHarness();
    const published = publish(memory, network, { targetNpcId: "detective" });
    assert.equal(published.published, true);
    assert.equal(published.queued, 1);
    assert.equal(memory.hasRumor("bartender", "social-test-report"), false);
    advance(14);
    assert.equal(memory.hasRumor("bartender", "social-test-report"), false);
    advance(1);
    const rumor = memory.getRumors("bartender")[0];
    assert.equal(rumor.reportedBy, "waiter");
    assert.equal(rumor.originalSourceNpcId, "waiter");
    assert.equal(rumor.transmissionPath.join(">"), "waiter>bartender");
    assert.equal(rumor.channel, "in_person");
});

test("NPCSocialNetwork defers an in-person rumor until both NPCs can meet", () => {
    const { memory, network, advance, availability } = createHarness();
    publish(memory, network, { targetNpcId: "detective" });
    availability.bartender.location = "police_station";
    advance(15);
    assert.equal(memory.hasRumor("bartender", "social-test-report"), false);
    availability.bartender.location = "bar_joe";
    advance(15);
    assert.equal(memory.hasRumor("bartender", "social-test-report"), true);
});

test("NPCSocialNetwork forwards a rumor over a second explicit edge without losing its origin", () => {
    const { memory, network, advance } = createHarness();
    publish(memory, network, { targetNpcId: "detective" });
    advance(15);
    assert.equal(memory.hasRumor("bartender", "social-test-report"), true);
    assert.equal(memory.hasRumor("journalist", "social-test-report"), false);
    advance(30);
    const rumor = memory.getRumors("journalist")[0];
    assert.equal(rumor.reportedBy, "bartender");
    assert.equal(rumor.originalSourceNpcId, "waiter");
    assert.equal(rumor.transmissionPath.join(">"), "waiter>bartender>journalist");
    assert.equal(rumor.hops, 2);
});

test("NPCSocialNetwork records when a character withholds information to protect someone", () => {
    const { memory, network } = createHarness();
    const sourceEvent = { dialogueId: "dialogue-eva", nodeId: "sister", answerText: "Анна не виновата." };
    memory.recordAnswerSelected("woman_in_red", sourceEvent.dialogueId, sourceEvent.nodeId, { text: sourceEvent.answerText });
    const result = network.publish("woman_in_red", {
        id: "protective-secret", kind: "detective_behavior", sourceName: "Ева",
        targetNpcId: "ex_wife", text: "Сведения, которые могут навредить Анне."
    }, sourceEvent);
    assert.equal(result.published, true);
    assert.equal(result.queued, 1);
    assert.equal(network.getWithheldReports()[0].protectedNpcId, "ex_wife");
    assert.equal(memory.hasRumor("journalist", "protective-secret"), false);
});

test("NPCSocialNetwork allows NPC-to-NPC calls even when player calling is disabled", () => {
    const { memory, network, advance } = createHarness();
    const sourceEvent = { dialogueId: "dialogue-eva", nodeId: "sister", answerText: "Я позвоню Анне." };
    memory.recordAnswerSelected("woman_in_red", sourceEvent.dialogueId, sourceEvent.nodeId, { text: sourceEvent.answerText });
    const result = network.publish("woman_in_red", {
        id: "sisters-phone-call", kind: "detective_behavior", sourceName: "Ева",
        text: "Детектив приходил к Анне."
    }, sourceEvent);
    assert.equal(result.queued, 2);
    advance(15);
    assert.equal(memory.hasRumor("ex_wife", "sisters-phone-call"), true);
});

test("NPCSocialNetwork shows reciprocal social bonds only once in a dossier", () => {
    const { network } = createHarness();
    const links = network.getRelationshipsForNPC("waiter");
    assert.equal(links.filter(link => link.npcId === "bartender").length, 1);
    assert.equal(links.find(link => link.npcId === "bartender").direction, "mutual");
});

test("NPCSocialNetwork persists pending deliveries and prevents duplicate publication", () => {
    const { memory, network, context } = createHarness();
    publish(memory, network);
    const duplicate = network.publish("waiter", {
        id: "social-test-report", kind: "detective_behavior", text: "Повтор"
    }, { dialogueId: "dialogue-waiter", nodeId: "greeting", answerText: "Я видел это." });
    assert.equal(duplicate.reason, "already_published");
    const snapshot = network.toJSON();
    assert.equal(snapshot.version, 1);
    assert.equal(snapshot.cases["case-002"].pending.length, 1);
    assert.equal(snapshot.cases["case-002"].publishedIds.includes("social-test-report"), true);
    context.snapshot = snapshot;
    context.memory = memory;
    const restored = vm.runInContext("NPCSocialNetwork.fromJSON(snapshot, memory, npcManager, clock)", context);
    assert.equal(restored.getPendingDeliveries().length, 1);
});

test("NPCSocialNetwork refuses to publish an event that the source NPC never witnessed", () => {
    const { network } = createHarness();
    const result = network.publish("waiter", {
        id: "unwitnessed", kind: "detective_behavior", text: "Слух без источника"
    }, { dialogueId: "dialogue-waiter", nodeId: "missing", answerText: "Этого ответа не было." });
    assert.equal(result.reason, "source_event_not_found");
});