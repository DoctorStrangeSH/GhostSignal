import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadClass(path, exportName, className) {
    const context = vm.createContext({ events: { emit() {} } });
    const source = readFileSync(resolve(root, path), "utf8");
    vm.runInContext(source + `\nglobalThis.${exportName} = ${className};`, context);
    return context[exportName];
}

test("rumor provenance stays unverified until the detective records a source inquiry", () => {
    const NPCMemoryService = loadClass(
        "assets/js/npc/npcMemoryService.js",
        "NPCMemoryServiceExport",
        "NPCMemoryService"
    );
    const Board = loadClass("assets/js/systems/board.js", "InvestigationBoardExport", "InvestigationBoard");
    const memory = new NPCMemoryService(null, "case-001");
    const board = new Board();
    board.setCase("case-001");

    const rumor = memory.recordClaim("porter", {
        id: "porter-rumor-claim",
        topic: "blackwood_departure",
        value: "Мэри видела, как Блэквуд покинул отель",
        summary: "Мэри якобы видела уход Блэквуда",
        directObservation: false,
        referencesRumorIds: ["mary-left-hotel"],
        sourceName: "Фрэнк, портье"
    });
    const sameWitnessFollowup = memory.recordClaim("porter", {
        id: "porter-followup-claim",
        topic: "blackwood_departure",
        value: "Мэри видела, как Блэквуд покинул отель",
        summary: "Портье повторяет ту же историю",
        directObservation: false,
        referencesRumorIds: ["mary-left-hotel"],
        sourceName: "Фрэнк, портье"
    });
    const secondhandWitness = memory.recordClaim("neighbor", {
        id: "neighbor-secondhand-claim",
        topic: "blackwood_departure",
        value: "Мэри видела, как Блэквуд покинул отель",
        summary: "Сосед слышал эту историю от других",
        directObservation: false,
        referencesRumorIds: ["mary-left-hotel"],
        sourceName: "Сосед"
    });
    const rumorChainWitness = memory.recordClaim("shopkeeper", {
        id: "shopkeeper-repeats-rumor",
        topic: "blackwood_departure",
        value: "Мэри видела, как Блэквуд покинул отель",
        summary: "Продавец лично слышал пересказ этой истории",
        directObservation: true,
        referencesRumorIds: ["mary-left-hotel"],
        sourceName: "Продавец"
    });
    const crossRumorWitness = memory.recordClaim("clerk", {
        id: "clerk-independent-of-current-rumor",
        topic: "unrelated_rumor_observation",
        value: "clerk-personally-saw-a-delivery-at-the-back-entrance",
        summary: "Клерк лично видел доставку у заднего входа",
        directObservation: true,
        referencesRumorIds: ["unrelated-rumor"],
        sourceName: "Клерк"
    });
    const witness = memory.recordClaim("bartender", {
        id: "bartender-direct-claim",
        topic: "blackwood_departure",
        value: "Чёрный ход был закрыт около двух часов",
        summary: "Джо лично проверил чёрный ход",
        directObservation: true,
        sourceName: "Джо, владелец бара"
    });

    assert.equal(rumor.added, true);
    assert.equal(sameWitnessFollowup.added, true);
    assert.equal(secondhandWitness.added, true);
    assert.equal(rumorChainWitness.added, true);
    assert.equal(crossRumorWitness.added, true);
    assert.equal(witness.added, true);
    const statements = memory.getStatements();
    const hypothesisId = board.addHypothesis("Мэри могла помочь Блэквуду скрыться");
    assert.ok(hypothesisId);
    assert.equal(board.linkHypothesis(hypothesisId, "statement", "porter-rumor-claim", "pending"), true);
    assert.equal(board.linkHypothesis(hypothesisId, "statement", "porter-followup-claim", "pending"), true);

    const sourceReview = board.reviewHypothesisSources(hypothesisId, statements);
    assert.equal(sourceReview.sources[0].origin, "unverified");
    assert.deepEqual(Array.from(sourceReview.sources[0].linkedRumorIds), ["mary-left-hotel"]);
    assert.equal(board.startSourceInquiry(hypothesisId, "unknown-rumor", statements), null);

    const inquiryId = board.startSourceInquiry(hypothesisId, "mary-left-hotel", statements);
    assert.ok(inquiryId);
    assert.deepEqual(Array.from(board.sourceInquiries[0].originSources, source => source.npcId), ["porter", "porter"]);
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "missing-statement",
        "Проверить источник", { statements, evidenceIds: [] }), false);
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "porter-followup-claim",
        "Портье повторяет собственную историю", { statements, evidenceIds: [] }), false,
        "the original rumor witness cannot be counted as independent corroboration");
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "neighbor-secondhand-claim",
        "Сосед пересказывает чужие слова", { statements, evidenceIds: [] }), false,
        "a secondhand retelling is not independent firsthand corroboration");
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "shopkeeper-repeats-rumor",
        "Продавец лично слышал тот же слух", { statements, evidenceIds: [] }), false,
        "firsthand knowledge that a rumor was repeated does not verify the rumor itself");
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "bartender-direct-claim",
        "Сопоставить личное наблюдение Джо со словами портье", { statements, evidenceIds: [] }), true);
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "clerk-independent-of-current-rumor",
        "Сопоставить отдельное личное наблюдение клерка", { statements, evidenceIds: [] }), true,
        "a witness tied to a different rumor may still independently clarify this one");
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "bartender-direct-claim",
        "Повторная запись", { statements, evidenceIds: [] }), false);
    assert.equal(board.closeSourceInquiry(inquiryId,
        "Показание портье пока не подтверждено независимым источником"), true);

    const restoredMemory = new NPCMemoryService(memory.toJSON(), "case-001");
    const restoredBoard = Board.fromJSON(board.toJSON());
    const restoredReview = restoredBoard.reviewHypothesisSources(hypothesisId, restoredMemory.getStatements());
    const restoredInquiry = restoredBoard.sourceInquiries.find(item => item.id === inquiryId);

    assert.equal(restoredReview.sources[0].origin, "unverified");
    assert.equal(restoredMemory.getStatementById("bartender-direct-claim").directObservation, true);
    assert.equal(restoredInquiry.status, "closed");
    assert.equal(restoredInquiry.leads[0].sourceId, "bartender-direct-claim");
    assert.equal(restoredInquiry.leads[0].npcId, "bartender");
    assert.equal(restoredInquiry.leads[0].sourceName, "Джо, владелец бара");
    assert.equal(restoredInquiry.leads[0].directObservation, true);
    assert.equal(restoredInquiry.leads[1].sourceId, "clerk-independent-of-current-rumor");
    assert.equal(restoredInquiry.leads[1].directObservation, true);
    assert.deepEqual(Array.from(restoredInquiry.originSources, source => source.npcId), ["porter", "porter"]);
    assert.equal(restoredInquiry.conclusion,
        "Показание портье пока не подтверждено независимым источником");

    const legacyHypothesisId = restoredBoard.addHypothesis("Старая проверка из сохранения");
    assert.equal(restoredBoard.linkHypothesis(legacyHypothesisId, "statement", "porter-rumor-claim", "pending"), true);
    restoredBoard.sourceInquiries.push({
        id: "inquiry-legacy",
        hypothesisId: legacyHypothesisId,
        rumorId: "mary-left-hotel",
        status: "open",
        leads: [],
        history: []
    });
    assert.equal(restoredBoard.addSourceInquiryLead("inquiry-legacy", "statement", "porter-followup-claim",
        "Попытка выдать повтор слов портье за независимый источник", {
            statements: restoredMemory.getStatements(),
            evidenceIds: []
        }), false, "legacy open inquiries must derive the original witness from saved statements");
});

test("superseded rumor statements do not block a later firsthand claim from the same witness", () => {
    const NPCMemoryService = loadClass("assets/js/npc/npcMemoryService.js", "NPCMemoryServiceExport", "NPCMemoryService");
    const Board = loadClass("assets/js/systems/board.js", "InvestigationBoardExport", "InvestigationBoard");
    const memory = new NPCMemoryService(null, "case-001");
    const board = new Board();
    board.setCase("case-001");

    const original = memory.recordClaim("porter", {
        id: "porter-superseded-rumor", topic: "departure", value: "mary-left-at-midnight",
        summary: "Старое показание портье", directObservation: false,
        referencesRumorIds: ["mary-left-hotel"], sourceName: "Фрэнк"
    });
    const revised = memory.recordClaim("porter", {
        id: "porter-revised-observation", topic: "departure", value: "porter-saw-mary-leave-at-22",
        summary: "Фрэнк уточнил время, которое видел лично", directObservation: true,
        revisesClaimId: "porter-superseded-rumor", sourceName: "Фрэнк"
    });
    const otherOrigin = memory.recordClaim("journalist", {
        id: "journalist-rumor-origin", topic: "carriage", value: "carriage-left-hotel",
        summary: "Журналист передал слух о карете", directObservation: false,
        referencesRumorIds: ["mary-left-hotel"], sourceName: "Журналист"
    });
    assert.equal(original.added, true);
    assert.equal(revised.added, true);
    assert.equal(otherOrigin.added, true);

    const hypothesisId = board.addHypothesis("Проверка времени ухода");
    assert.equal(board.linkHypothesis(hypothesisId, "statement", "porter-superseded-rumor", "pending"), true);
    assert.equal(board.linkHypothesis(hypothesisId, "statement", "journalist-rumor-origin", "pending"), true);
    const inquiryId = board.startSourceInquiry(hypothesisId, "mary-left-hotel", memory.getStatements());
    assert.ok(inquiryId);
    assert.deepEqual(Array.from(board.sourceInquiries[0].originSources, source => source.npcId), ["journalist"]);
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "porter-revised-observation",
        "Сопоставить новое личное наблюдение Фрэнка", { statements: memory.getStatements(), evidenceIds: [] }), true);

    const uiSource = readFileSync(resolve(root, "assets/js/ui/boardUI.js"), "utf8");
    assert.ok(uiSource.includes("source.status === 'active' &&"),
        "the UI must use the same active-source rule as the domain layer");
});
