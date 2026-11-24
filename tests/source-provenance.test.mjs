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
    const witness = memory.recordClaim("bartender", {
        id: "bartender-direct-claim",
        topic: "blackwood_departure",
        value: "Чёрный ход был закрыт около двух часов",
        summary: "Джо лично проверил чёрный ход",
        directObservation: true,
        sourceName: "Джо, владелец бара"
    });

    assert.equal(rumor.added, true);
    assert.equal(witness.added, true);
    const statements = memory.getStatements();
    const hypothesisId = board.addHypothesis("Мэри могла помочь Блэквуду скрыться");
    assert.ok(hypothesisId);
    assert.equal(board.linkHypothesis(hypothesisId, "statement", "porter-rumor-claim", "pending"), true);

    const sourceReview = board.reviewHypothesisSources(hypothesisId, statements);
    assert.equal(sourceReview.sources[0].origin, "unverified");
    assert.deepEqual(Array.from(sourceReview.sources[0].linkedRumorIds), ["mary-left-hotel"]);
    assert.equal(board.startSourceInquiry(hypothesisId, "unknown-rumor", statements), null);

    const inquiryId = board.startSourceInquiry(hypothesisId, "mary-left-hotel", statements);
    assert.ok(inquiryId);
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "missing-statement",
        "Проверить источник", { statements, evidenceIds: [] }), false);
    assert.equal(board.addSourceInquiryLead(inquiryId, "statement", "bartender-direct-claim",
        "Сопоставить личное наблюдение Джо со словами портье", { statements, evidenceIds: [] }), true);
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
    assert.equal(restoredInquiry.conclusion,
        "Показание портье пока не подтверждено независимым источником");
});
