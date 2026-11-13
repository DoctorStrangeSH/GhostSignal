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
    assert.equal(restored.toJSON().version, 10);
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
    assert.equal(memory.toJSON().version, 10);
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
    assert.equal(shared.rumor.sourceTrust, 50);
    assert.equal(shared.rumor.confidence, 60);
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

    assert.equal(restored.toJSON().version, 10);
    assert.equal(restored.getRumors("waiter").length, 0);
    assert.equal(restored.getMemory("waiter").rumors.length, 0);
    assert.equal(restored.getTrust("waiter"), 61);
});

test("NPCMemoryService weights rumors by source trust and requires independent witnesses", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    const report = { id: "detective-threatened-thomas", kind: "detective_behavior", sourceName: "Томас", text: "Детектив пригрозил обвинить меня в соучастии." };
    const sourceEvent = { dialogueId: "dialogue-waiter", nodeId: "greeting", answerText: "Если ты скрываешь информацию — это соучастие." };
    memory.recordAnswerSelected("waiter", sourceEvent.dialogueId, sourceEvent.nodeId, { text: sourceEvent.answerText, tone: "aggressive" });
    assert.equal(memory.setRelationshipTrust("bartender", "waiter", 80), 80);
    const shared = memory.shareExperience("waiter", "bartender", report, sourceEvent);
    assert.equal(shared.shared, true);
    assert.equal(shared.rumor.sourceTrust, 80);
    assert.equal(shared.rumor.confidence, 78);

    memory.recordClaim("journalist", { id: "journalist-hearsay", topic: "detective-threatened-thomas", value: "threatened", directObservation: false, corroboratesRumorIds: [report.id] });
    assert.equal(memory.corroborateRumor("bartender", report.id, "journalist", "journalist-hearsay").reason, "independent_witness_not_found");

    memory.recordClaim("bartender", { id: "joe-witnessed-threat", topic: "detective-threatened-thomas", value: "threatened", directObservation: true, corroboratesRumorIds: [report.id] });
    const corroborated = memory.corroborateRumor("bartender", report.id, "bartender", "joe-witnessed-threat");
    assert.equal(corroborated.corroborated, true);
    assert.equal(corroborated.rumor.status, "corroborated");
    assert.equal(corroborated.rumor.confidence, 98);
    assert.equal(memory.corroborateRumor("bartender", report.id, "bartender", "joe-witnessed-threat").reason, "witness_already_recorded");

    memory.recordClaim("journalist", { id: "journalist-refutes-threat", topic: "detective-threatened-thomas", value: "not-present", directObservation: true, refutesRumorIds: [report.id] });
    const challenged = memory.challengeRumor("bartender", report.id, "journalist", "journalist-refutes-threat");
    assert.equal(challenged.challenged, true);
    assert.equal(challenged.rumor.status, "disputed");
    assert.equal(challenged.rumor.confidence, 78);

    const restored = NPCMemoryService.fromJSON(memory.toJSON(), "case-002");
    assert.equal(restored.getRumors("bartender")[0].status, "disputed");
    assert.equal(restored.getRumors("bartender")[0].corroborations.length, 1);
    assert.equal(restored.getRumors("bartender")[0].challenges.length, 1);
});

test("NPCMemoryService migrates v5 rumors without losing their source", () => {
    const NPCMemoryService = loadService();
    const restored = NPCMemoryService.fromJSON({ version: 5, currentCaseId: "case-002", cases: { "case-002": { bartender: { rumors: [{ id: "legacy-rumor", kind: "detective_behavior", text: "Старый слух", reportedBy: "waiter", reportedByName: "Томас", status: "unverified" }] } } } }, "case-002");
    const [rumor] = restored.getRumors("bartender");
    assert.equal(restored.toJSON().version, 10);
    assert.equal(rumor.reportedBy, "waiter");
    assert.equal(rumor.confidence, 60);
    assert.equal(rumor.corroborations.length, 0);
    assert.equal(rumor.challenges.length, 0);
});

test("NPCMemoryService preserves testimony revisions and excludes superseded claims from contradictions", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.recordClaim("waiter", { id: "waiter-original", topic: "kane-presence", value: "at-table", summary: "Томас видел Кейна у столика" });
    memory.recordClaim("business_rival", { id: "kane-alibi", topic: "kane-presence", value: "left-early", summary: "Кейн утверждает, что ушёл раньше" });
    assert.equal(memory.getContradictions().length, 1);

    const revised = memory.recordClaim("waiter", {
        id: "waiter-revised", revisesClaimId: "waiter-original", revisionReason: "После изучения фотографии",
        topic: "kane-presence", value: "near-table-before-collapse", summary: "Томас уточнил время и границы наблюдения"
    });
    assert.equal(revised.added, true);
    assert.equal(memory.getStatementById("waiter-original").status, "superseded");
    assert.equal(memory.getStatementById("waiter-original").supersededBy, "waiter-revised");
    assert.equal(memory.getStatementById("waiter-revised").version, 2);
    assert.equal(memory.getStatementById("waiter-revised").revisionOf, "waiter-original");
    assert.equal(memory.compareStatements("waiter-original", "kane-alibi").status, "superseded_statement");
    assert.equal(memory.getContradictions().length, 1);
    assert.equal(memory.getContradictions()[0].first.id === "waiter-revised" || memory.getContradictions()[0].second.id === "waiter-revised", true);
    assert.equal(memory.getClaimHistory("waiter", "waiter-revised").length, 2);
    assert.equal(memory.getClaimHistory("waiter", "waiter-revised")[0].id, "waiter-original");

    const restored = NPCMemoryService.fromJSON(memory.toJSON(), "case-002");
    assert.equal(restored.getClaimHistory("waiter", "waiter-revised").length, 2);
    assert.equal(restored.toJSON().version, 10);
    assert.equal(restored.recordClaim("waiter", { id: "bad-revision", revisesClaimId: "missing", topic: "kane-presence", value: "unknown" }).reason, "revision_source_not_found");
});

test("NPCMemoryService migrates v6 claims as active version one", () => {
    const NPCMemoryService = loadService();
    const restored = NPCMemoryService.fromJSON({ version: 6, currentCaseId: "case-002", cases: { "case-002": { waiter: { claims: [{ id: "old-claim", topic: "topic", value: "value" }] } } } }, "case-002");
    const claim = restored.getStatementById("old-claim");
    assert.equal(restored.toJSON().version, 10);
    assert.equal(claim.version, 1);
    assert.equal(claim.status, "active");
    assert.equal(claim.revisionOf, null);
});

test("NPCMemoryService summarizes case-scoped trust, promises, rumors and testimony for endings", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    memory.adjustTrust("waiter", -20);
    memory.recordPromise("waiter", { id: "protect-family", text: "Защитить семью", fulfillment: { type: "insight_gained", insightId: "full_confession_kane" } });
    memory.recordPromise("bartender", { id: "deliver-recording", text: "Передать запись", fulfillment: { type: "item_acquired", itemId: "recording" } });
    memory.recordClaim("waiter", { id: "statement-v1", topic: "topic", value: "first" });
    memory.recordClaim("waiter", { id: "statement-v2", revisesClaimId: "statement-v1", topic: "topic", value: "second" });
    const summary = memory.getCaseSocialSummary("case-002");
    assert.equal(summary.npcs.waiter.trust, 30);
    assert.equal(summary.npcs.waiter.promises.pending, 1);
    assert.equal(summary.npcs.waiter.claims.active, 1);
    assert.equal(summary.npcs.waiter.claims.superseded, 1);
    assert.equal(summary.npcs.bartender.promises.pending, 1);
    assert.equal(summary.npcs.waiter.accusations.pending, 0);
    assert.equal(summary.npcs.waiter.accusations.false, 0);
    assert.deepEqual(Object.keys(memory.getCaseSocialSummary("case-001").npcs), []);
});

test("NPCMemoryService records false accusations, applies lasting consequences and persists them", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-002");
    const recorded = memory.recordAccusation("waiter", { id: "thomas-complicity", text: "Детектив обвинил Томаса в соучастии." });
    assert.equal(recorded.recorded, true);
    assert.equal(memory.hasAccusation("waiter", "thomas-complicity"), true);
    assert.equal(memory.getAccusations("waiter")[0].status, "pending");
    const resolved = memory.resolveAccusation("waiter", "thomas-complicity", "false", "Томас был невиновен; детектив признал ошибку.");
    assert.equal(resolved.resolved, true);
    assert.equal(resolved.accusation.status, "false");
    assert.equal(memory.getTrust("waiter"), 40);
    assert.equal(memory.getPressure("waiter"), 8);
    assert.equal(memory.getCaseSocialSummary("case-002").npcs.waiter.accusations.false, 1);
    assert.equal(memory.resolveAccusation("waiter", "thomas-complicity", "false").reason, "already_resolved");
    const restored = NPCMemoryService.fromJSON(memory.toJSON(), "case-002");
    assert.equal(restored.getAccusations("waiter")[0].status, "false");
    assert.equal(restored.toJSON().version, 10);
});

test("NPCMemoryService migrates v8 memories with an empty long-term people ledger", () => {
    const NPCMemoryService = loadService();
    const restored = NPCMemoryService.fromJSON({ version: 8, currentCaseId: "case-002", cases: { "case-002": { waiter: { trust: 37 } } } }, "case-002");
    assert.equal(restored.toJSON().version, 10);
    restored.recordDialogueStarted("waiter", "legacy-save-followup");
    const profile = restored.getLongTermProfile("waiter");
    assert.equal(profile.npcId, "waiter");
    assert.equal(profile.trust, 37);
    assert.equal(profile.familiarity, 1);
    assert.equal(profile.interactions, 1);
    assert.equal(profile.lastSeenCaseId, "case-002");
    assert.equal(profile.memoryCount, 1);
    assert.equal(profile.disposition, "guarded");
    assert.equal(restored.getMemory("waiter").trust, 37);
    assert.equal(restored.getAccusations("waiter").length, 0);
});

test("NPCMemoryService carries lasting impressions and trust into a later investigation", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-001");
    memory.recordDialogueStarted("bartender", "dialogue-bartender");
    memory.recordAnswerSelected("bartender", "dialogue-bartender", "greeting", {
        text: "Не заставляй меня повторять, Джо. Я знаю, что ты скрываешь.",
        tone: "threatening",
        memorySummary: "Детектив пригрозил Джо, требуя рассказать правду.",
        memoryTags: ["player_threatened"],
        memoryImportance: 4
    });

    const profile = memory.getLongTermProfile("bartender");
    assert.equal(profile.familiarity, 1);
    assert.equal(profile.disposition, "cautious");
    assert.equal(profile.trust < 50, true);
    assert.equal(memory.hasLongTermMemoryTag("bartender", "player_threatened"), true);
    assert.equal(memory.getLongTermMemories("bartender")[0].caseId, "case-001");

    const restored = NPCMemoryService.fromJSON(memory.toJSON(), "case-002");
    restored.recordDialogueStarted("bartender", "dialogue-bartender-case2");
    assert.equal(restored.getMemory("bartender").trust, profile.trust);
    assert.equal(restored.getLongTermProfile("bartender").familiarity, 2);
    assert.equal(restored.hasLongTermMemoryTag("bartender", "player_threatened"), true);
});

test("NPCMemoryService remembers promises kept or broken beyond the case that created them", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-001");
    memory.recordPromise("porter", {
        id: "find-mary", text: "Я выясню, что случилось с Мэри.",
        fulfillment: { type: "case_solved", caseId: "case-001" }
    });
    assert.equal(memory.settlePromisesForCase("case-001", "solved")[0].status, "fulfilled");
    assert.equal(memory.hasLongTermMemoryTag("porter", "promise_kept"), true);
    const trustAfterKeeping = memory.getLongTermProfile("porter").trust;
    assert.equal(trustAfterKeeping > 50, true);

    memory.setCase("case-002");
    memory.recordDialogueStarted("porter", "followup");
    assert.equal(memory.getMemory("porter").trust, trustAfterKeeping);
    assert.equal(memory.getLongTermMemories("porter").some(item => item.type === "promise_kept"), true);
});

test("NPCMemoryService makes a false accusation a lasting reason for distrust", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-001");
    memory.recordAccusation("housekeeper", {
        id: "false-accusation", text: "Детектив обвинил Мэри в исчезновении."
    });
    memory.resolveAccusation("housekeeper", "false-accusation", "false", "Улика доказала, что Мэри не причастна.");
    assert.equal(memory.getLongTermProfile("housekeeper").trust, 45);
    assert.equal(memory.hasLongTermMemoryTag("housekeeper", "false_accusation"), true);

    memory.setCase("case-002");
    memory.recordDialogueStarted("housekeeper", "later-meeting");
    assert.equal(memory.getMemory("housekeeper").trust, 45);
});

test("NPCMemoryService bounds long-term memory without discarding the strongest events", () => {
    const NPCMemoryService = loadService();
    const memory = new NPCMemoryService(null, "case-001");
    for (let i = 0; i < 70; i++) {
        memory.recordAnswerSelected("bartender", "dialogue", "node-" + i, {
            text: "Детектив угрожает Джо " + i,
            tone: "threatening",
            memoryImportance: i === 0 ? 5 : 3,
            memoryTags: i === 0 ? ["critical_betrayal"] : ["player_threatened"]
        });
    }
    assert.equal(memory.getLongTermProfile("bartender").memoryCount, 60);
    assert.equal(memory.hasLongTermMemoryTag("bartender", "critical_betrayal"), true);
    assert.equal(memory.getLongTermMemories("bartender", { limit: 100 }).length, 60);
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
