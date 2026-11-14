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
    for (const path of ["assets/js/npc/npcMemoryService.js", "assets/js/npc/npcMotivationService.js", "assets/js/npc/npcSocialNetwork.js"]) {
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
        npcMotivations: {
            bartender: {
                motives: [
                    { id: "protect_staff", weight: 85, pressureResistance: 0.55 },
                    { id: "keep_bar_open", weight: 65, pressureResistance: 0.20 }
                ],
                loyalties: [
                    { npcId: "waiter", strength: 86, protectThreshold: 62, appliesTo: ["detective_behavior"], motiveId: "protect_staff", reason: "protecting_colleague" }
                ]
            },
            woman_in_red: {
                motives: [
                    { id: "protect_sister", weight: 100, pressureResistance: 0.72 },
                    { id: "avoid_public_scandal", weight: 35, pressureResistance: 0.12 }
                ],
                loyalties: [
                    { npcId: "ex_wife", strength: 96, protectThreshold: 60, appliesTo: ["detective_behavior"], motiveId: "protect_sister", reason: "protecting_sister" }
                ]
            }
        },
        socialNetwork: {
            maxHops: 2, retryMinutes: 15, expiryMinutes: 240,
            edges: [
                { id: "waiter-joe", from: "waiter", to: "bartender", relationship: "coworkers", label: "Коллеги", trust: 80, channel: "in_person", delayMinutes: 15, minTrustToShare: 35, shareTypes: ["detective_behavior"], canForward: true },
                { id: "joe-waiter", from: "bartender", to: "waiter", relationship: "coworkers", label: "Коллеги", trust: 70, channel: "in_person", delayMinutes: 20, minTrustToShare: 35, shareTypes: ["detective_behavior"], canForward: false },
                { id: "joe-press", from: "bartender", to: "journalist", relationship: "source", label: "Источник в баре", trust: 65, channel: "message", delayMinutes: 30, minTrustToShare: 50, shareTypes: ["detective_behavior"], canForward: true },
                { id: "eva-press", from: "woman_in_red", to: "journalist", relationship: "protective", label: "Защищает сестру", trust: 70, channel: "message", delayMinutes: 20, minTrustToShare: 30, shareTypes: ["detective_behavior"], protectsNpcIds: [], withholdIfTargetProtected: false },
                { id: "eva-anna", from: "woman_in_red", to: "ex_wife", relationship: "siblings", label: "Сёстры", trust: 95, channel: "phone", delayMinutes: 10, minTrustToShare: 20, shareTypes: ["detective_behavior"], canForward: true },
                { id: "anna-eva", from: "ex_wife", to: "woman_in_red", relationship: "siblings", label: "Сёстры", trust: 95, channel: "phone", delayMinutes: 10, minTrustToShare: 20, shareTypes: ["detective_behavior"], canForward: true }
            ]
        }
    };
    context.clock = clock;
    context.availability = availability;
    context.npcManager = npcManager;
    context.caseData = caseData;
    const setup = vm.runInContext("(() => { const memory = new NPCMemoryService(null, 'case-002'); const motivations = new NPCMotivationService(memory); const network = new NPCSocialNetwork(null, memory, npcManager, clock); network.setMotivationService(motivations); network.setCase(caseData); return { memory, motivations, network }; })()", context);
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
    assert.equal(snapshot.version, 3);
    assert.equal(snapshot.cases["case-002"].pending.length, 1);
    assert.equal(snapshot.cases["case-002"].publishedIds.includes("social-test-report"), true);
    context.snapshot = snapshot;
    context.memory = memory;
    const restored = vm.runInContext("NPCSocialNetwork.fromJSON(snapshot, memory, npcManager, clock)", context);
    assert.equal(restored.getPendingDeliveries().length, 1);
});


test("NPCSocialNetwork keeps a chronological, attributed timeline of scheduled and delivered contacts", () => {
    const { memory, network, advance } = createHarness();
    publish(memory, network, { targetNpcId: "detective" });

    const scheduled = network.getEventLog(10);
    assert.equal(scheduled[0].type, "scheduled");
    assert.equal(scheduled[0].fromName, "Томас");
    assert.equal(scheduled[0].toName, "Джо");
    assert.equal(scheduled[0].channel, "in_person");
    assert.equal(scheduled[0].time, "18:00");
    assert.equal(scheduled[0].summary.includes("пригрозил"), true);

    advance(15);
    const delivered = network.getEventLog(10).find(item =>
        item.type === "delivered" && item.toNpcId === "bartender"
    );
    assert.equal(delivered.fromNpcId, "waiter");
    assert.equal(delivered.toNpcId, "bartender");
    assert.equal(delivered.path.join(">"), "waiter>bartender");
    assert.equal(network.getEventLog(10, "bartender").every(item =>
        item.fromNpcId === "bartender" || item.toNpcId === "bartender" || item.protectedNpcId === "bartender"
    ), true);
});

test("NPCSocialNetwork explains withheld information without exposing the protected report", () => {
    const { memory, network } = createHarness();
    const sourceEvent = { dialogueId: "dialogue-eva", nodeId: "sister", answerText: "Анна не виновата." };
    memory.recordAnswerSelected("woman_in_red", sourceEvent.dialogueId, sourceEvent.nodeId, { text: sourceEvent.answerText });
    network.publish("woman_in_red", {
        id: "protected-timeline-entry", kind: "detective_behavior", sourceName: "Ева",
        targetNpcId: "ex_wife", text: "Секретные сведения о деле."
    }, sourceEvent);

    const withheld = network.getEventLog(10).find(item => item.type === "withheld");
    assert.equal(withheld.fromName, "Ева");
    assert.equal(withheld.toName, "Лора");
    assert.equal(withheld.protectedNpcName, "Анна");
    assert.equal(withheld.reason, "loyalty_protection");
    assert.equal(withheld.summary.includes("Секретные сведения"), false);
});

test("NPCSocialNetwork logs a failed contact only once while retries continue", () => {
    const { memory, network, advance, availability } = createHarness();
    availability.bartender.location = "police_station";
    publish(memory, network, { targetNpcId: "detective" });

    advance(15);
    advance(15);
    const delayed = network.getEventLog(20).filter(item => item.type === "delayed");
    assert.equal(delayed.length, 1);
    assert.equal(network.getPendingDeliveries().length, 1);
});

test("NPCSocialNetwork migrates old saves and persists the social event timeline", () => {
    const { memory, network, context } = createHarness();
    publish(memory, network, { targetNpcId: "detective" });
    const snapshot = network.toJSON();
    assert.equal(snapshot.version, 3);
    assert.equal(snapshot.cases["case-002"].eventLog.length >= 2, true);
    assert.equal(snapshot.cases["case-002"].knownEventIds.length, 0);

    context.snapshot = snapshot;
    context.memory = memory;
    const restored = vm.runInContext("NPCSocialNetwork.fromJSON(snapshot, memory, npcManager, clock)", context);
    assert.equal(restored.getEventLog(10).length, network.getEventLog(10).length);
    assert.equal(restored.getKnownEventLog(10).length, 0);

    context.legacySnapshot = { currentCaseId: "case-002", cases: { "case-002": { pending: [], delivered: [], withheld: [], publishedIds: [] } } };
    const legacy = vm.runInContext("NPCSocialNetwork.fromJSON(legacySnapshot, memory, npcManager, clock)", context);
    assert.equal(legacy.getEventLog(10).length, 0);
});

test("NPCMotivationService uses weighted personal motives to resist pressure", () => {
    const { memory, motivations } = createHarness();
    assert.equal(motivations.hasMotive("bartender", "protect_staff"), true);
    assert.equal(motivations.hasMotive("bartender", "invented_motive"), false);
    const calm = motivations.getEffectiveLoyalty("bartender", "waiter");
    assert.equal(calm.score, 86);
    assert.equal(calm.protects, true);
    assert.equal(calm.pressure, 0);
    for (let i = 0; i < 5; i++) memory.recordAnswerSelected("bartender", "dialogue-pressure", "calm-" + i, { text: "Я задаю прямой вопрос.", tone: "direct" });
    const pressured = motivations.getEffectiveLoyalty("bartender", "waiter");
    assert.equal(pressured.pressure, 10);
    assert.equal(pressured.score < calm.score, true);
    assert.equal(pressured.protects, true);
});

test("NPCSocialNetwork records loyalty protection and withholds a report while the NPC remains loyal", () => {
    const { memory, network } = createHarness();
    const sourceEvent = { dialogueId: "dialogue-joe", nodeId: "quiet-answer", answerText: "Томас не имеет к этому отношения." };
    memory.recordAnswerSelected("bartender", sourceEvent.dialogueId, sourceEvent.nodeId, { text: sourceEvent.answerText, tone: "neutral" });
    const result = network.publish("bartender", { id: "joe-protects-thomas", kind: "detective_behavior", sourceName: "Джо", targetNpcId: "waiter", text: "Томас рассказал мне о разговоре с детективом." }, sourceEvent);
    assert.equal(result.published, true);
    assert.equal(result.queued, 1);
    const withheld = network.getWithheldReports()[0];
    assert.equal(withheld.fromNpcId, "bartender");
    assert.equal(withheld.toNpcId, "journalist");
    assert.equal(withheld.reason, "loyalty_protection");
    assert.equal(withheld.motiveId, "protect_staff");
    assert.equal(withheld.loyaltyScore, 86);
});

test("NPCSocialNetwork records a betrayal when pressure breaks a character loyalty", () => {
    const { memory, motivations, network, advance } = createHarness();
    const sourceEvent = { dialogueId: "dialogue-joe", nodeId: "final-answer", answerText: "Я больше не стану покрывать Томаса." };
    for (let i = 0; i < 8; i++) memory.recordAnswerSelected("bartender", sourceEvent.dialogueId, i === 7 ? sourceEvent.nodeId : "pressure-" + i, { text: i === 7 ? sourceEvent.answerText : "Вы продолжаете давить на меня.", tone: "threatening" });
    const loyalty = motivations.getEffectiveLoyalty("bartender", "waiter");
    assert.equal(loyalty.protects, false);
    const result = network.publish("bartender", { id: "joe-breaks-silence", kind: "detective_behavior", sourceName: "Джо", targetNpcId: "waiter", text: "Томас рассказал мне о разговоре с детективом." }, sourceEvent);
    assert.equal(result.published, true);
    assert.equal(result.queued, 2);
    const betrayal = network.getEventLog(20).find(item => item.type === "betrayal");
    assert.equal(betrayal.fromNpcId, "bartender");
    assert.equal(betrayal.toNpcId, "journalist");
    assert.equal(betrayal.protectedNpcId, "waiter");
    assert.equal(betrayal.reason, "loyalty_broken");
    assert.equal(betrayal.pressureScore, 96);
    advance(30);
    assert.equal(memory.hasRumor("journalist", "joe-breaks-silence"), true);
});

test("NPCSocialNetwork keeps world events hidden until the detective learns about them", () => {
    const { memory, network, advance } = createHarness();
    publish(memory, network, { targetNpcId: "detective" });
    assert.equal(network.getEventLog(20).length > 0, true);
    advance(15);
    assert.equal(network.getKnownEventLog(20).length, 0);
    const revealed = network.revealEventsForReport("social-test-report", {
        method: "dialogue", sourceId: "dialogue-bartender:greeting:2",
        eventTypes: ["delivered"], fromNpcId: "waiter", toNpcId: "bartender"
    });
    assert.equal(revealed.revealed, 1);
    const known = network.getKnownEventLog(20);
    assert.equal(known.length, 1);
    assert.equal(known[0].type, "delivered");
    assert.equal(known[0].fromNpcId, "waiter");
    assert.equal(known[0].toNpcId, "bartender");
    assert.equal(network.revealEventsForReport("social-test-report", { method: "telepathy", sourceId: "invalid" }).reason, "invalid_discovery");
});

test("NPCSocialNetwork refuses to publish an event that the source NPC never witnessed", () => {
    const { network } = createHarness();
    const result = network.publish("waiter", {
        id: "unwitnessed", kind: "detective_behavior", text: "Слух без источника"
    }, { dialogueId: "dialogue-waiter", nodeId: "missing", answerText: "Этого ответа не было." });
    assert.equal(result.reason, "source_event_not_found");
});
test("forwarded rumors cannot be independently confirmed or refuted by their original source", () => {
    const { memory, network, advance } = createHarness();
    publish(memory, network, { targetNpcId: "detective" });
    advance(15);
    advance(30);
    const rumor = memory.getRumors("journalist").find(item => item.id === "social-test-report");
    assert.equal(rumor.reportedBy, "bartender");
    assert.equal(rumor.originalSourceNpcId, "waiter");
    memory.recordClaim("waiter", {
        id: "source-claims-true", topic: "threat", value: "yes",
        directObservation: true, corroboratesRumorIds: ["social-test-report"]
    });
    memory.recordClaim("waiter", {
        id: "source-claims-false", topic: "threat-dispute", value: "no",
        directObservation: true, refutesRumorIds: ["social-test-report"]
    });
    assert.equal(memory.corroborateRumor("journalist", "social-test-report", "waiter", "source-claims-true").reason, "not_independent");
    assert.equal(memory.challengeRumor("journalist", "social-test-report", "waiter", "source-claims-false").reason, "not_independent");
    assert.equal(memory.getRumors("journalist")[0].status, "unverified");

    // An independent observer may corroborate only through an explicit, recorded observation.
    memory.recordClaim("woman_in_red", {
        id: "eva-saw-threat", topic: "threat", value: "yes",
        directObservation: true, corroboratesRumorIds: ["social-test-report"]
    });
    assert.equal(memory.corroborateRumor("journalist", "social-test-report", "woman_in_red", "eva-saw-threat").corroborated, true);
    assert.equal(memory.getRumors("journalist")[0].status, "corroborated");
});

test("a recorded public accusation moves Anna → Eva → Lora with delays and verifiable provenance", () => {
    const { memory, network, advance } = createHarness();
    const accusationId = "public-final-accusation:case-002:ex_wife";
    const rumorId = "public-accusation-case-002-ex_wife";
    const unrecorded = network.publishPublicAccusation("ex_wife", accusationId);
    assert.equal(unrecorded.published, false, "cannot start with a fabricated accusation");

    memory.recordAccusation("ex_wife", { id: accusationId, text: "Детектив публично обвинил Анну." });
    assert.equal(network.publishPublicAccusation("ex_wife", accusationId).published, false, "pending accusation is not yet verified");
    memory.resolveAccusation("ex_wife", accusationId, "false", "Wrong suspect");

    const published = network.publishPublicAccusation("ex_wife", accusationId);
    assert.equal(published.published, true);
    assert.equal(published.queued, 1);
    assert.equal(network.publishPublicAccusation("ex_wife", accusationId).published, false, "same event is only published once");
    assert.equal(memory.hasRumor("woman_in_red", rumorId), false);
    advance(9);
    assert.equal(memory.hasRumor("woman_in_red", rumorId), false);
    advance(1);
    const eva = memory.getRumors("woman_in_red").find(item => item.id === rumorId);
    assert.equal(eva.originalSourceNpcId, "ex_wife");
    assert.equal(eva.reportedBy, "ex_wife");
    assert.equal(eva.sourceDialogueId, "public_accusation");
    assert.equal(eva.sourceNodeId, accusationId);
    assert.equal(eva.transmissionPath.join(">"), "ex_wife>woman_in_red");
    assert.equal(memory.hasRumor("journalist", rumorId), false);

    advance(19);
    assert.equal(memory.hasRumor("journalist", rumorId), false);
    advance(1);
    const lora = memory.getRumors("journalist").find(item => item.id === rumorId);
    assert.ok(lora, "Lora heard from Eva's existing protective channel");
    assert.equal(lora.reportedBy, "woman_in_red");
    assert.equal(lora.originalSourceNpcId, "ex_wife");
    assert.equal(lora.transmissionPath.join(">"), "ex_wife>woman_in_red>journalist");
    assert.equal(lora.hops, 2);
    assert.match(lora.text, /оспаривается/);
});

test("private deductions cannot be injected into the rumor network", () => {
    const { memory, network } = createHarness();
    const id = "public-final-accusation:case-002:ex_wife";
    memory.recordAccusation("ex_wife", { id, text: "An unverified accusation" });
    const blocked = network.publishPublicAccusation("ex_wife", id);
    assert.equal(blocked.published, false);
    assert.equal(network.getPendingDeliveries().length, 0);
    assert.equal(network.publishPublicAccusation("ex_wife", "unrelated-id").published, false);
});

test("verified correction propagates only after Anna receives it, with separate sourced timeline", () => {
    const { memory, network, advance } = createHarness();
    const accused = "ex_wife";
    const accusationId = "public-final-accusation:case-002:ex_wife";
    const restitutionId = "anna-public-accusation-repaired-with-kane-confession";
    const correctionId = "verified-restitution-case-002-ex_wife";
    const sourceEvent = { dialogueId: "dialogue-ex-wife", nodeId: "anna_public_restitution" };

    assert.equal(network.publishVerifiedRestitution(accused, restitutionId, accusationId, sourceEvent).published, false);
    memory.recordAccusation(accused, { id: accusationId, text: "Детектив обвинил Анну" });
    memory.resolveAccusation(accused, accusationId, "false");
    assert.equal(network.publishVerifiedRestitution(accused, restitutionId, accusationId, sourceEvent).published, false,
        "apology and accusation resolution without restitution cannot create a correction rumor");

    memory.recordVerifiedRestitution(accused, restitutionId, accusationId);
    assert.equal(network.publishVerifiedRestitution(accused, restitutionId, accusationId, sourceEvent).published, false,
        "proof held in inventory is not a witnessed conversation");
    memory.recordNodeVisited(accused, sourceEvent.dialogueId, { id: sourceEvent.nodeId, speaker: "npc" });

    const result = network.publishVerifiedRestitution(accused, restitutionId, accusationId, sourceEvent);
    assert.equal(result.published, true);
    assert.equal(result.queued, 1);
    assert.equal(network.publishVerifiedRestitution(accused, restitutionId, accusationId, sourceEvent).published, false);
    assert.equal(memory.hasRumor("woman_in_red", correctionId), false);
    advance(10);
    const eva = memory.getRumors("woman_in_red").find(item => item.id === correctionId);
    assert.ok(eva);
    assert.equal(eva.originalSourceNpcId, accused);
    assert.equal(eva.sourceDialogueId, sourceEvent.dialogueId);
    assert.equal(eva.sourceNodeId, sourceEvent.nodeId);
    assert.equal(eva.reportedBy, accused);
    assert.equal(memory.hasRumor("journalist", correctionId), false);

    advance(20);
    const lora = memory.getRumors("journalist").find(item => item.id === correctionId);
    assert.ok(lora);
    assert.equal(lora.reportedBy, "woman_in_red");
    assert.equal(lora.originalSourceNpcId, accused);
    assert.equal(lora.transmissionPath.join(">"), "ex_wife>woman_in_red>journalist");
    assert.match(lora.text, /проверить независимо/);
});

test("a correction rumor rejects mismatched records and cannot be fabricated for an innocent case", () => {
    const { memory, network } = createHarness();
    const accusationId = "public-final-accusation:case-002:ex_wife";
    const restitutionId = "anna-public-accusation-repaired-with-kane-confession";
    const source = { dialogueId: "dialogue-ex-wife", nodeId: "anna_public_restitution" };
    memory.recordAccusation("ex_wife", { id: accusationId, text: "Ложное обвинение" });
    memory.resolveAccusation("ex_wife", accusationId, "false");
    memory.recordNodeVisited("ex_wife", source.dialogueId, { id: source.nodeId });
    assert.equal(network.publishVerifiedRestitution("ex_wife", restitutionId, accusationId, source).published, false);
    assert.equal(network.publishVerifiedRestitution("woman_in_red", restitutionId, accusationId, source).published, false);
    assert.equal(network.publishVerifiedRestitution("ex_wife", restitutionId, accusationId,
        { dialogueId: "other", nodeId: source.nodeId }).published, false);
    assert.equal(network.getPendingDeliveries().length, 0);
});
