import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const evidence = new Map([
    ["guest_book", { id: "guest_book", isEvidence: true }],
    ["hidden_note", { id: "hidden_note", isEvidence: true }],
    ["ordinary_key", { id: "ordinary_key", isEvidence: false }]
]);

function loadBoard() {
    const context = vm.createContext({
        getObjectById: id => evidence.get(id) || null,
        events: { emit() {} }
    });
    const source = readFileSync(resolve(root, "assets/js/systems/board.js"), "utf8");
    vm.runInContext(source + "\nglobalThis.InvestigationBoardExport = InvestigationBoard;", context);
    return context.InvestigationBoardExport;
}

test("investigation board round-trips clues, hypotheses, source inquiries, alibis and route questions", () => {
    const Board = loadBoard();
    const board = new Board();
    board.caseId = "case-001";
    board.slots[0].evidenceId = "guest_book";
    board.slots[4].evidenceId = "hidden_note";
    board.evidenceOnBoard = ["guest_book", "hidden_note"];
    board.hypotheses = [{
        id: "hyp-4",
        title: "Кейн мог изменить запись",
        status: "open",
        alternativeGroupId: "hyp-4",
        links: [{ kind: "evidence", sourceId: "guest_book", stance: "against" }],
        history: [
            { action: "created", title: "Кейн мог изменить запись" },
            { action: "alternative_group_created", groupId: "hyp-4" },
            { action: "revised", previous: "Кейн мог изменить запись", title: "Кейн мог изменить запись после полуночи" }
        ]
    }, {
        id: "hyp-5",
        title: "Запись могла быть изменена раньше",
        status: "abandoned",
        alternativeGroupId: "hyp-4",
        links: [{ kind: "evidence", sourceId: "hidden_note", stance: "pending" }],
        history: [{ action: "created", title: "Запись могла быть изменена раньше" }]
    }];
    board.sourceInquiries = [{
        id: "inquiry-3",
        hypothesisId: "hyp-4",
        rumorId: "rumor-17",
        status: "closed",
        conclusion: "Источник не подтвердил время",
        originSources: [],
        leads: [{ kind: "evidence", sourceId: "hidden_note", note: "Сверить с оригиналом" }],
        history: [{ action: "opened", rumorId: "rumor-17" }, { action: "closed", note: "Источник не подтвердил время" }]
    }];
    board.alibiClaims = [{
        id: "alibi-2", subject: "Томас", location: "Отель", locationId: "hotel_grand",
        startMinute: 600, endMinute: 630, precision: "approximate", kind: "statement",
        sourceId: "statement-4", uncertaintyMinutes: 10
    }];
    board.routeQuestions = [{
        npcId: "waiter", ids: ["alibi-2", "alibi-2"], caseId: "case-001", discussed: true
    }];
    board.nextHypothesisId = 6;
    board.nextInquiryId = 4;
    board.nextAlibiId = 3;

    const snapshot = structuredClone(board.toJSON());
    const restored = Board.fromJSON(snapshot);

    assert.equal(JSON.stringify(restored.toJSON()), JSON.stringify(snapshot));
    assert.equal(restored.getHypothesisHistory("hyp-4").length, 3);
    assert.equal(restored.getHypothesisAlternatives("hyp-4").length, 2);
    assert.equal(restored.sourceInquiries[0].conclusion, "Источник не подтвердил время");
    assert.equal(restored.routeQuestions[0].discussed, true);
});

test("board restoration derives placed evidence from valid unique occupied slots", () => {
    const Board = loadBoard();
    const restored = Board.fromJSON({
        caseId: "case-001",
        slots: [
            { id: "slot-1", evidenceId: "guest_book" },
            { id: "slot-2", evidenceId: "guest_book" },
            { id: "slot-3", evidenceId: "ordinary_key" },
            { id: "slot-4", evidenceId: "missing_clue" },
            { id: "slot-5", evidenceId: "hidden_note" },
            { id: "unknown-slot", evidenceId: "guest_book" }
        ],
        // This field may be stale after an interrupted/legacy save. Slots are authoritative.
        evidenceOnBoard: ["missing_clue", "ordinary_key", "ghost_entry"]
    });

    assert.equal(restored.slots.find(slot => slot.id === "slot-1").evidenceId, "guest_book");
    assert.equal(restored.slots.find(slot => slot.id === "slot-2").evidenceId, null,
        "the same clue cannot occupy two slots after restoration");
    assert.equal(restored.slots.find(slot => slot.id === "slot-3").evidenceId, null,
        "non-evidence objects cannot be restored onto the investigation board");
    assert.equal(restored.slots.find(slot => slot.id === "slot-4").evidenceId, null);
    assert.equal(JSON.stringify(restored.evidenceOnBoard), JSON.stringify(["guest_book", "hidden_note"]));
});

test("restored board counters advance beyond existing IDs and case reset clears investigation-only state", () => {
    const Board = loadBoard();
    const restored = Board.fromJSON({
        caseId: "case-001",
        slots: [],
        hypotheses: [{ id: "hyp-9", title: "Версия", status: "open", links: [], history: [] }],
        sourceInquiries: [{ id: "inquiry-7", hypothesisId: "hyp-9", rumorId: "rumor", leads: [], history: [] }],
        alibiClaims: [{
            id: "alibi-8", subject: "Томас", location: "Отель", sourceId: "statement-1",
            kind: "statement", precision: "exact", startMinute: 10, endMinute: 20
        }],
        nextHypothesisId: 2,
        nextInquiryId: 1,
        nextAlibiId: 1
    });

    assert.equal(restored.nextHypothesisId, 10);
    assert.equal(restored.nextInquiryId, 8);
    assert.equal(restored.nextAlibiId, 9);
    restored.setCase("case-002");
    assert.equal(restored.caseId, "case-002");
    assert.equal(restored.hypotheses.length, 0);
    assert.equal(restored.sourceInquiries.length, 0);
    assert.equal(restored.alibiClaims.length, 0);
    assert.equal(restored.routeQuestions.length, 0);
    assert.equal(restored.nextHypothesisId, 1);
    assert.equal(restored.nextInquiryId, 1);
    assert.equal(restored.nextAlibiId, 1);
});


test("inventory restoration keeps board clues owned but removes them from the available clue pool", () => {
    const context = vm.createContext({
        getObjectById: id => evidence.get(id) || null,
        events: { emit() {} }
    });
    const source = readFileSync(resolve(root, "assets/js/systems/inventory.js"), "utf8");
    vm.runInContext(source + "\nglobalThis.InventoryExport = Inventory;", context);
    const inventory = context.InventoryExport.fromJSON({
        items: ["magnifying_glass", "guest_book", "hidden_note"],
        evidence: ["guest_book", "hidden_note"],
        insights: ["missing_page"],
        currentWeight: 3
    });

    assert.equal(inventory.reconcileBoardEvidence(["guest_book"]), 1);
    assert.equal(JSON.stringify(inventory.evidence), JSON.stringify(["hidden_note"]));
    assert.equal(inventory.hasItem("guest_book"), true,
        "placing a clue on the board does not remove ownership of the physical item");
    assert.equal(inventory.hasInsight("missing_page"), true);
    assert.equal(inventory.reconcileBoardEvidence(["guest_book"]), 0,
        "reconciliation is safe to run more than once");
});
