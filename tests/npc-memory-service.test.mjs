import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadService() {
    const context = vm.createContext({ console, Date });
    const source = readFileSync(resolve(root, "assets/js/npc/npcMemoryService.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__exported = NPCMemoryService;", context);
    return context.__exported;
}

test("NPCMemoryService records conversations, visited nodes, selected answers and trust", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");

    memory.recordDialogueStarted("waiter", "dialogue-waiter");
    memory.recordNodeVisited("waiter", "dialogue-waiter", {
        id: "greeting", speaker: "npc", text: "Я ничего не знаю."
    });
    memory.recordAnswerSelected("waiter", "dialogue-waiter", "greeting", {
        text: "Расскажите спокойно.", tone: "calm"
    });
    memory.recordAnswerSelected("waiter", "dialogue-waiter", "greeting", {
        text: "Не заставляйте меня ждать.", tone: "aggressive"
    });

    const saved = memory.getMemory("waiter");
    assert.equal(saved.conversations, 1);
    assert.equal(saved.dialogueHistory.length, 4);
    assert.equal(saved.trust, 48);
    assert.equal(saved.dialogueHistory[1].nodeId, "greeting");
    assert.equal(saved.dialogueHistory[2].trustDelta, 1);
    assert.equal(saved.dialogueHistory[3].trustDelta, -3);
});

test("NPCMemoryService records evidence once per NPC and remembers who saw it", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");

    const first = memory.recordEvidencePresented("waiter", "dialogue-waiter", "bar_photo");
    assert.equal(first.recorded, true);
    assert.equal(first.reason, null);
    const duplicate = memory.recordEvidencePresented("waiter", "dialogue-waiter", "bar_photo");
    assert.equal(duplicate.recorded, false);
    assert.equal(duplicate.reason, "already_presented");
    assert.equal(memory.hasPresentedEvidence("waiter", "bar_photo"), true);
    assert.equal(memory.hasPresentedEvidence("business_rival", "bar_photo"), false);
    assert.equal(memory.getMemory("waiter").presentedEvidence.length, 1);
});

test("NPCMemoryService detects explicit conflicting claims on the same topic", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");

    memory.recordClaim("waiter", {
        id: "waiter-at-scene",
        topic: "kane-presence-during-poisoning",
        value: "present-at-bar-during-poisoning",
        summary: "Томас видел Кейна у стола Блэквуда"
    });
    const result = memory.recordClaim("business_rival", {
        id: "kane-left-early",
        topic: "kane-presence-during-poisoning",
        value: "left-before-poisoning",
        summary: "Кейн утверждает, что ушёл до отравления"
    });

    assert.equal(result.added, true);
    assert.equal(result.contradictions.length, 1);
    assert.equal(result.contradictions[0].topic, "kane-presence-during-poisoning");
    assert.deepEqual(
        [result.contradictions[0].first.npcId, result.contradictions[0].second.npcId].sort(),
        ["business_rival", "waiter"]
    );
});

test("NPCMemoryService ignores corroborating claims and contradictions from another case", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.recordClaim("waiter", {
        id: "waiter-at-scene", topic: "kane-presence", value: "at-bar"
    });
    memory.recordClaim("bartender", {
        id: "bartender-at-scene", topic: "kane-presence", value: "at-bar"
    });
    assert.equal(memory.getContradictions().length, 0);

    memory.setCase("case-001");
    memory.recordClaim("porter", {
        id: "porter-claim", topic: "kane-presence", value: "left-early"
    });
    assert.equal(memory.getContradictions().length, 0);
});

test("NPCMemoryService clamps trust and round-trips versioned per-case saves", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    assert.equal(memory.adjustTrust("waiter", 1000), 100);
    assert.equal(memory.adjustTrust("waiter", -1000), 0);

    memory.setCase("case-001");
    memory.recordDialogueStarted("housekeeper", "dialogue-housekeeper");
    const restored = NPCMemoryService.fromJSON(memory.toJSON(), "case-002");

    assert.equal(restored.getMemory("waiter").trust, 0);
    assert.equal(restored.getMemory("housekeeper"), null);
    restored.setCase("case-001");
    assert.equal(restored.getMemory("housekeeper").conversations, 1);
    assert.equal(restored.toJSON().version, 5);
});

test("NPCMemoryService tracks psychological pressure and migrates older NPC snapshots", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService({
        version: 2,
        currentCaseId: "case-002",
        cases: {
            "case-002": {
                waiter: { trust: 48, conversations: 1, dialogueHistory: [], presentedEvidence: [], claims: [] }
            }
        }
    }, "case-002");

    assert.equal(memory.getPressure("waiter"), 0);
    assert.equal(memory.getMemory("waiter").liesExposed.length, 0);
    assert.equal(memory.getMemory("waiter").promises.length, 0);
    memory.recordAnswerSelected("waiter", "dialogue-waiter", "greeting", {
        text: "Я тебе угрожаю.", tone: "aggressive"
    });
    assert.equal(memory.getTrust("waiter"), 45);
    assert.equal(memory.getPressure("waiter"), 8);
    const state = memory.getPsychologicalState("waiter", { pressureThreshold: 20, opennessThreshold: 60 });
    assert.equal(state.disposition, "reserved");
    assert.equal(state.pressure, 8);

    memory.recordAnswerSelected("waiter", "dialogue-waiter", "threat", {
        text: "Последнее предупреждение.", tone: "threatening"
    });
    assert.equal(memory.getPressure("waiter"), 20);
    assert.equal(memory.getPsychologicalState("waiter", { pressureThreshold: 20 }).disposition, "overwhelmed");
    assert.equal(memory.toJSON().version, 5);
});

test("NPCMemoryService records a deliberate lie as exposed only when its source is confronted", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.recordClaim("waiter", {
        id: "waiter-at-bar", topic: "kane-presence", value: "present"
    });
    memory.recordClaim("business_rival", {
        id: "kane-left-early", topic: "kane-presence", value: "left",
        deception: { deliberate: true, motive: "self_preservation" }
    });

    assert.equal(memory.hasExposedLie("business_rival", "kane-left-early"), false);
    assert.equal(memory.prepareConfrontation("waiter-at-bar", "kane-left-early", "business_rival").prepared, true);
    assert.equal(memory.recordConfrontation("business_rival", "kane_alibi_broken"), true);
    assert.equal(memory.hasExposedLie("business_rival", "kane-left-early"), true);
    assert.equal(memory.getPressure("business_rival"), 25);
    assert.equal(memory.getPsychologicalState("business_rival", { pressureThreshold: 50 }).disposition, "pressured");
    assert.equal(memory.getMemory("business_rival").dialogueHistory.some(entry => entry.type === "lie_exposed"), true);
});

test("NPCMemoryService records, fulfills and persists NPC promises", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");

    const recorded = memory.recordPromise("waiter", {
        id: "protect-thomas-family",
        text: "Защитить семью Томаса",
        fulfillment: { type: "case_solved", caseId: "case-002" },
        fulfilledTrustDelta: 6,
        brokenTrustDelta: -8
    });
    assert.equal(recorded.recorded, true);
    assert.equal(recorded.promise.status, "pending");
    assert.equal(memory.getPromises("waiter").length, 1);
    assert.equal(memory.recordPromise("waiter", {
        id: "protect-thomas-family",
        text: "Дубликат",
        fulfillment: { type: "case_solved", caseId: "case-002" }
    }).reason, "already_recorded");

    memory.recordPromise("bartender", {
        id: "bring-recording",
        text: "Передать запись бармену",
        fulfillment: { type: "insight_gained", insightId: "recording_recovered" }
    });
    memory.recordPromise("pharmacist", {
        id: "deliver-order",
        text: "Передать документ о защите семьи",
        fulfillment: { type: "item_acquired", itemId: "family_protection_order" }
    });
    const restored = NPCMemoryService.fromJSON(memory.toJSON(), "case-002");
    assert.equal(restored.getPromises("waiter")[0].status, "pending");

    const changes = restored.resolvePromisesForEvent({
        type: "insight_gained",
        insightId: "recording_recovered"
    });
    assert.equal(changes.length, 1);
    assert.equal(changes[0].npcId, "bartender");
    assert.equal(restored.getPromises("bartender")[0].status, "fulfilled");
    assert.equal(restored.getTrust("bartender"), 53);

    const itemChanges = restored.resolvePromisesForEvent({
        type: "item_acquired",
        itemId: "family_protection_order"
    });
    assert.equal(itemChanges.length, 1);
    assert.equal(itemChanges[0].npcId, "pharmacist");
    assert.equal(restored.getPromises("pharmacist")[0].status, "fulfilled");

    const settled = restored.settlePromisesForCase("case-002", "solved");
    assert.equal(settled.length, 1);
    assert.equal(settled[0].status, "fulfilled");
    assert.equal(restored.getPromises("waiter")[0].status, "fulfilled");
    assert.equal(restored.getTrust("waiter"), 56);
});

test("NPCMemoryService breaks unresolved promises when a case fails", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.recordPromise("waiter", {
        id: "protect-family",
        text: "Защитить семью",
        fulfillment: { type: "case_solved", caseId: "case-002" },
        brokenTrustDelta: -8
    });
    memory.recordPromise("bartender", {
        id: "find-recording",
        text: "Найти запись",
        fulfillment: { type: "insight_gained", insightId: "recording_recovered" }
    });

    const changes = memory.settlePromisesForCase("case-002", "failed");
    assert.equal(changes.length, 2);
    assert.equal(changes.every(change => change.status === "broken"), true);
    assert.equal(memory.getTrust("waiter"), 42);
    assert.equal(memory.getPromises("waiter")[0].status, "broken");
    assert.equal(memory.getMemory("waiter").dialogueHistory.at(-1).type, "promise_broken");
});

test("NPCMemoryService does not fulfill a promise when the case ends without its promised outcome", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.recordPromise("waiter", {
        id: "protect-thomas-family",
        text: "Обеспечить безопасность семьи Томаса",
        fulfillment: { type: "insight_gained", insightId: "full_confession_kane" },
        brokenTrustDelta: -8
    });

    const changes = memory.settlePromisesForCase("case-002", "solved");
    assert.equal(changes.length, 1);
    assert.equal(changes[0].status, "broken");
    assert.equal(memory.getPromises("waiter")[0].status, "broken");
    assert.equal(memory.getTrust("waiter"), 42);
});

test("NPCMemoryService rejects malformed promises and unknown resolution events", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    assert.equal(memory.recordPromise("waiter", { id: "bad", text: "Без условия" }).reason, "invalid_promise");
    assert.equal(memory.resolvePromisesForEvent({ type: "unknown", id: "x" }).length, 0);
    assert.equal(memory.settlePromisesForCase("case-002", "abandoned").length, 0);
});

test("NPCMemoryService shares an observed detective action as an attributed unverified rumor", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    const report = {
        id: "detective-threatened-thomas",
        kind: "detective_behavior",
        sourceName: "Томас",
        text: "Детектив пригрозил обвинить меня в соучастии."
    };

    assert.equal(memory.shareExperience("waiter", "bartender", report, {
        dialogueId: "dialogue-waiter",
        nodeId: "greeting",
        answerText: "Если ты скрываешь информацию — это соучастие."
    }).reason, "source_event_not_found");

    memory.recordAnswerSelected("waiter", "dialogue-waiter", "greeting", {
        text: "Если ты скрываешь информацию — это соучастие.",
        tone: "aggressive"
    });
    const shared = memory.shareExperience("waiter", "bartender", report, {
        dialogueId: "dialogue-waiter",
        nodeId: "greeting",
        answerText: "Если ты скрываешь информацию — это соучастие.",
        tone: "aggressive"
    });
    assert.equal(shared.shared, true);
    assert.equal(shared.rumor.status, "unverified");
    assert.equal(shared.rumor.reportedBy, "waiter");
    assert.equal(memory.hasRumor("bartender", report.id), true);
    assert.equal(memory.hasRumor("waiter", report.id), false);
    assert.equal(memory.hasRumor("business_rival", report.id), false);
    assert.equal(memory.getStatements().length, 0);
    assert.equal(memory.getContradictions().length, 0);
    assert.equal(memory.getMemory("bartender").dialogueHistory.at(-1).type, "rumor_received");
    assert.equal(memory.shareExperience("waiter", "bartender", report, {
        dialogueId: "dialogue-waiter",
        nodeId: "greeting",
        answerText: "Если ты скрываешь информацию — это соучастие."
    }).reason, "already_shared");

    const restored = NPCMemoryService.fromJSON(memory.toJSON(), "case-002");
    assert.equal(restored.hasRumor("bartender", report.id), true);
    assert.equal(restored.getRumors("bartender")[0].reportedByName, "Томас");
});

test("NPCMemoryService migrates version 4 memories with no rumor history", () => {
    const NPCMemoryService = loadService();
    const restored = NPCMemoryService.fromJSON({
        version: 4,
        currentCaseId: "case-002",
        cases: {
            "case-002": {
                waiter: {
                    trust: 61,
                    pressure: 4,
                    conversations: 1,
                    dialogueHistory: [],
                    presentedEvidence: [],
                    claims: [],
                    liesExposed: [],
                    promises: []
                }
            }
        }
    }, "case-002");

    assert.equal(restored.toJSON().version, 5);
    assert.equal(restored.getRumors("waiter").length, 0);
    assert.equal(restored.getMemory("waiter").rumors.length, 0);
    assert.equal(restored.getTrust("waiter"), 61);
});

test("NPCMemoryService safely accepts saves created before NPC memory existed", () => {
    const NPCMemoryService = loadService();
    const memory = NPCMemoryService.fromJSON(null, "case-001");

    assert.equal(memory.getMemory("porter"), null);
    assert.equal(memory.getTrust("porter"), 50);
    assert.equal(memory.hasPresentedEvidence("porter", "old_clue"), false);
    assert.equal(memory.getContradictions().length, 0);
});


test("NPCMemoryService exposes testimony with source, location, time and circumstances", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.recordClaim("waiter", {
        id: "waiter-statement",
        topic: "kane-presence",
        value: "present",
        summary: "Томас видел Кейна в баре",
        sourceName: "Томас",
        location: "Бар «У Джо»",
        timeLabel: "Вечер отравления",
        circumstances: "Показание после обещания защиты"
    });

    const statements = memory.getStatements();
    assert.equal(statements.length, 1);
    assert.equal(statements[0].sourceName, "Томас");
    assert.equal(statements[0].location, "Бар «У Джо»");
    assert.equal(statements[0].timeLabel, "Вечер отравления");
    assert.equal(statements[0].circumstances, "Показание после обещания защиты");
    assert.equal(memory.getStatementById("waiter-statement").npcId, "waiter");
});

test("NPCMemoryService distinguishes contradiction, corroboration and unrelated topics", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.recordClaim("waiter", {
        id: "waiter-at-bar", topic: "kane-presence", value: "present"
    });
    memory.recordClaim("bartender", {
        id: "bartender-at-bar", topic: "kane-presence", value: "present"
    });
    memory.recordClaim("business_rival", {
        id: "kane-left-early", topic: "kane-presence", value: "left"
    });
    memory.recordClaim("pharmacist", {
        id: "prescription", topic: "anna-purchase", value: "sedative"
    });

    assert.equal(memory.compareStatements("waiter-at-bar", "bartender-at-bar").status, "corroboration");
    assert.equal(memory.compareStatements("waiter-at-bar", "prescription").status, "different_topics");
    assert.equal(memory.compareStatements("waiter-at-bar", "kane-left-early").status, "contradiction");
    assert.equal(memory.compareStatements("waiter-at-bar", "missing").status, "statement_not_found");
});

test("NPCMemoryService prepares and records a contradiction confrontation exactly once", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.recordClaim("waiter", {
        id: "waiter-at-bar", topic: "kane-presence", value: "present",
        summary: "Томас видел Кейна в баре"
    });
    memory.recordClaim("business_rival", {
        id: "kane-left-early", topic: "kane-presence", value: "left",
        summary: "Кейн утверждает, что ушёл раньше"
    });

    assert.equal(memory.prepareConfrontation("waiter-at-bar", "kane-left-early", "pharmacist").reason, "target_not_involved");
    const prepared = memory.prepareConfrontation("waiter-at-bar", "kane-left-early", "business_rival");
    assert.equal(prepared.prepared, true);
    assert.equal(memory.getPreparedConfrontation("waiter"), null);
    assert.equal(memory.getPreparedConfrontation("business_rival").contradiction.topic, "kane-presence");

    const restored = NPCMemoryService.fromJSON(memory.toJSON(), "case-002");
    assert.equal(restored.getPreparedConfrontation("business_rival").firstId, "waiter-at-bar");
    assert.equal(restored.recordConfrontation("business_rival", "kane_alibi_broken"), true);
    assert.equal(restored.getMemory("business_rival").dialogueHistory.at(-1).responseId, "kane_alibi_broken");
    assert.equal(restored.getPreparedConfrontation("business_rival"), null);
    assert.equal(restored.hasConfronted("business_rival", "waiter-at-bar", "kane-left-early"), true);
    assert.equal(restored.recordConfrontation("business_rival", "duplicate"), false);
    assert.equal(restored.prepareConfrontation("waiter-at-bar", "kane-left-early", "business_rival").reason, "already_confronted");
    assert.equal(restored.getMemory("business_rival").dialogueHistory.some(entry => entry.type === "contradiction_presented"), true);
});
