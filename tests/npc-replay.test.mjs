import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const context = vm.createContext({ console });
vm.runInContext(readFileSync(resolve(root, "assets/js/npc/npcMemoryService.js"), "utf8") +
    "\n;globalThis.NPCMemoryServiceForTest = NPCMemoryService;", context);
const NPCMemoryService = context.NPCMemoryServiceForTest;

test("replaying a case keeps NPC long-term trust but clears evidence and testimony", () => {
    const saved = {
        currentCaseId: "case-002",
        people: { waiter: { trust: 31, memories: [{ type: "broken_promise" }] } },
        cases: {
            "case-001": { bartender: { claims: [{ id: "other-case" }] } },
            "case-002": { waiter: { claims: [{ id: "old-claim" }], promises: [{ id: "old-promise" }] } }
        }
    };
    const memory = NPCMemoryService.fromJSON(saved, "case-002");
    assert.equal(memory.resetCase("case-002"), true);
    memory.setCase("case-002");
    const next = JSON.parse(JSON.stringify(memory.toJSON()));
    assert.deepEqual(next.cases["case-002"], {});
    assert.deepEqual(next.cases["case-001"], saved.cases["case-001"]);
    assert.equal(next.people.waiter.trust, 31);
    assert.deepEqual(next.people.waiter.memories, [{ type: "broken_promise" }]);
    assert.deepEqual(saved.cases["case-002"].waiter.claims, [{ id: "old-claim" }]);
});

test("resetting an unknown case does not discard profiles", () => {
    const memory = new NPCMemoryService(null, "case-001");
    assert.equal(memory.resetCase(null), false);
    assert.equal(memory.resetCase("case-999"), true);
    assert.ok(memory.toJSON().cases["case-001"]);
});
