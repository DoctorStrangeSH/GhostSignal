import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npcScript = readFileSync(resolve(root, "assets/js/npc/npcManager.js"), "utf8");

function createManager({ caseId = "case-002", decision = null, hour = 10 } = {}) {
    const waiter = {
        id: "waiter",
        name: "Томас",
        availableForChat: true,
        availableForCall: true,
        schedule: {
            awake: { start: 6, end: 23 },
            atWork: { start: 9, end: 17 },
            locations: { work: "bar_joe", home: "thomas_home" }
        }
    };
    const context = vm.createContext({
        console,
        events: { emit() {} },
        getNPCById: id => id === "waiter" ? waiter : null,
        getCaseById: () => ({ npcs: ["waiter"] }),
        getLocationById: id => ({ id })
    });
    vm.runInContext(npcScript, context);
    const clock = { hour };
    const ManagerClass = vm.runInContext("NPCManager", context);
    const manager = new ManagerClass(clock, null);
    manager.loadNPCsForCase({ id: caseId, npcs: ["waiter"] });
    manager.setRelationshipService({
        getWitnessWorkDecision(npcId, ruleId) {
            assert.equal(npcId, "waiter");
            assert.equal(ruleId, "thomas-decides-work-after-protection-delay");
            return decision;
        },
        getKnownRelationshipsForNPC() { return []; }
    });
    return { manager, clock, context };
}

test("Thomas stays away from the bar during shifts after choosing temporary leave", () => {
    const { manager, clock } = createManager({ decision: "temporary_leave" });
    assert.equal(manager.isNPCAvailable("waiter").reason, "temporary_leave");
    assert.equal(manager.isNPCAvailable("waiter").location, "thomas_home");
    assert.equal(manager.getNPCsAtLocation("bar_joe").length, 0);
    assert.equal(manager.getNPCsAtLocation("thomas_home").length, 1);
    assert.equal(manager.getNPCStatus("waiter").canChat, true);
    clock.hour = 19;
    assert.equal(manager.isNPCAvailable("waiter").reason, "at_home");
    clock.hour = 1;
    assert.equal(manager.isNPCAvailable("waiter").reason, "unavailable");
});

test("Paperwork decision and other cases keep the normal work schedule", () => {
    for (const scenario of [
        { caseId: "case-002", decision: "document_help" },
        { caseId: "case-002", decision: null },
        { caseId: "case-001", decision: "temporary_leave" }
    ]) {
        const { manager } = createManager(scenario);
        assert.equal(manager.isNPCAvailable("waiter").reason, "at_work");
        assert.equal(manager.isNPCAvailable("waiter").location, "bar_joe");
    }
});

test("Restoring NPCManager keeps temporary leave when the relationship state is reattached", () => {
    const { manager, clock, context } = createManager({ decision: "temporary_leave" });
    const snapshot = JSON.parse(JSON.stringify(manager.toJSON()));
    context.savedManagerState = snapshot;
    context.savedClock = clock;
    const restored = vm.runInContext("NPCManager.fromJSON(savedManagerState, savedClock, null, 'case-002')", context);
    restored.setRelationshipService({
        getWitnessWorkDecision() { return "temporary_leave"; },
        getKnownRelationshipsForNPC() { return []; }
    });
    assert.equal(restored.isNPCAvailable("waiter").reason, "temporary_leave");
    assert.equal(restored.getNPCsAtLocation("bar_joe").length, 0);
});
