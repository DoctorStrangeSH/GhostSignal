import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEventController(globals = {}) {
    const context = vm.createContext({ console, ...globals });
    const source = readFileSync(resolve(root, "assets/js/controllers/eventController.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__exported = EventController;", context);
    return context.__exported;
}

function createEventBus() {
    const listeners = new Map();
    const emitted = [];
    return {
        listeners,
        emitted,
        on(name, handler) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(handler);
            return () => listeners.get(name)?.delete(handler);
        },
        emit(name, payload) {
            emitted.push({ name, payload });
            for (const handler of listeners.get(name) || []) handler(payload);
        },
        listenerCount() {
            return [...listeners.values()].reduce((count, set) => count + set.size, 0);
        }
    };
}

test("EventController registers app event handlers once and disposes subscriptions and timers", () => {
    const eventBus = createEventBus();
    const timers = [];
    const cleared = [];
    const app = {
        currentScreen: "screen-main-menu",
        progress: null,
        _quickSave() {},
        authManager: null,
        syncManager: null
    };
    const EventController = loadEventController({
        setInterval(callback, delay) {
            const id = timers.length + 1;
            timers.push({ id, callback, delay });
            return id;
        },
        clearInterval(id) { cleared.push(id); }
    });
    const controller = new EventController(app, eventBus);

    controller.bind();
    const firstCount = eventBus.listenerCount();
    controller.bind();

    assert.ok(firstCount >= 25);
    assert.equal(eventBus.listenerCount(), firstCount);
    assert.deepEqual(timers.map(timer => timer.delay), [10000, 30000]);

    controller.dispose();

    assert.equal(eventBus.listenerCount(), 0);
    assert.deepEqual(cleared, [1, 2]);
    assert.equal(controller.bound, false);
});

test("cloud sync captures a fresh snapshot and skips failed or unauthenticated saves", () => {
    const timers = [];
    const synced = [];
    const progress = { activeCase: "case-002", npcMemoryData: { version: 0 } };
    let loggedIn = false;
    let canSave = true;
    let saves = 0;
    const app = {
        progress,
        authManager: { isUserLoggedIn: () => loggedIn },
        syncManager: { saveEverywhere(snapshot) { synced.push(structuredClone(snapshot)); } },
        _quickSave() {
            saves++;
            if (!canSave) return false;
            progress.npcMemoryData = { version: saves };
            return true;
        }
    };
    const EventController = loadEventController({
        setInterval(callback, delay) { timers.push({ callback, delay }); return timers.length; },
        clearInterval() {}
    });
    new EventController(app, createEventBus()).bind();
    const sync = timers.find(timer => timer.delay === 30000).callback;

    sync();
    assert.equal(saves, 0);
    assert.equal(synced.length, 0);

    loggedIn = true;
    sync();
    assert.equal(synced.length, 1);
    assert.deepEqual(synced[0].npcMemoryData, { version: 1 });

    canSave = false;
    sync();
    assert.equal(synced.length, 1);
});

test("pagehide saves the latest investigation and unregisters on dispose", () => {
    const listeners = new Map();
    const removed = [];
    let saves = 0;
    const app = { progress: { activeCase: "case-002" }, _quickSave() { saves++; return true; } };
    const EventController = loadEventController({
        window: {
            addEventListener(name, handler) { listeners.set(name, handler); },
            removeEventListener(name, handler) { removed.push([name, handler]); }
        },
        setInterval() { return 1; },
        clearInterval() {}
    });
    const controller = new EventController(app, createEventBus());
    controller.bind();
    const pagehide = listeners.get("pagehide");
    assert.equal(typeof pagehide, "function");
    pagehide();
    assert.equal(saves, 1);

    app.progress = null;
    pagehide();
    assert.equal(saves, 1);

    controller.dispose();
    assert.equal(removed.length, 1);
    assert.equal(removed[0][0], "pagehide");
    assert.equal(removed[0][1], pagehide);
});

test("EventController persists NPC memory without auto-revealing contradictions", () => {
    const eventBus = createEventBus();
    let saves = 0;
    const app = {
        progress: {},
        npcMemoryService: { toJSON: () => ({ currentCaseId: "case-002" }) },
        _saveProgress() { saves++; }
    };
    const EventController = loadEventController({ setInterval: () => 1, clearInterval() {} });
    const controller = new EventController(app, eventBus);

    controller.bind();
    eventBus.emit("npc:memory_changed", {});
    assert.deepEqual(app.progress.npcMemoryData, { currentCaseId: "case-002" });
    assert.equal(saves, 1);

    eventBus.emit("npc:contradiction_detected", {
        contradictions: [{
            first: { summary: "Кейн ушёл раньше" },
            second: { summary: "Кейн был у стола" }
        }]
    });
    assert.equal(eventBus.emitted.some(item => item.name === "notification:show"), false);
    controller.dispose();
});

test("EventController resolves and persists NPC promises from game events", () => {
    const eventBus = createEventBus();
    const calls = [];
    let saves = 0;
    const app = {
        progress: { activeCase: "case-002" },
        npcMemoryService: {
            toJSON() { return { currentCaseId: "case-002" }; },
            resolvePromisesForEvent(event) {
                calls.push({ method: "resolve", event });
                return [{ npcId: "waiter", promiseId: "test-promise", status: "fulfilled" }];
            },
            settlePromisesForCase(caseId, outcome) {
                calls.push({ method: "settle", caseId, outcome });
                return [{ npcId: "waiter", promiseId: "test-promise", status: "broken" }];
            }
        },
        inventory: { evidence: [], toJSON: () => ({ items: [] }) },
        caseManager: {
            currentCase: { id: "case-002" },
            onInsightGained() {},
            onItemAcquired() {}
        },
        npcManager: { checkAutoTriggers() {} },
        evidenceChainSystem: { checkChains() {} },
        reputationSystem: { caseFailed() {}, toJSON: () => ({ reputation: 40 }) },
        _saveProgress() { saves++; }
    };
    const EventController = loadEventController({
        getObjectById: () => ({ isEvidence: false }),
        setInterval: () => 1,
        clearInterval() {}
    });
    const controller = new EventController(app, eventBus);
    controller.bind();

    eventBus.emit("insight:gained", { insightId: "recording_recovered" });
    eventBus.emit("inventory:changed", { action: "add", itemId: "family_protection_order" });
    eventBus.emit("case:failed", { caseId: "case-002" });

    assert.deepEqual(calls.map(call => call.method), ["resolve", "resolve", "settle"]);
    assert.equal(calls[0].event.type, "insight_gained");
    assert.equal(calls[0].event.insightId, "recording_recovered");
    assert.equal(calls[1].event.type, "item_acquired");
    assert.equal(calls[1].event.itemId, "family_protection_order");
    assert.equal(calls[2].caseId, "case-002");
    assert.equal(calls[2].outcome, "failed");
    assert.deepEqual(app.progress.npcMemoryData, { currentCaseId: "case-002" });
    assert.ok(saves >= 5);
    controller.dispose();
});

test("EventController fulfills case-scoped promises when a case is solved", () => {
    const eventBus = createEventBus();
    const calls = [];
    let quickSaves = 0;
    let saves = 0;
    const app = {
        progress: { activeCase: "case-002", solvedCases: [] },
        npcMemoryService: {
            toJSON: () => ({ currentCaseId: "case-002" }),
            settlePromisesForCase(caseId, outcome) {
                calls.push({ caseId, outcome });
                return [{ npcId: "waiter", promiseId: "protect-family", status: "fulfilled" }];
            }
        },
        caseManager: {
            currentCase: { id: "case-002", title: "Последний заказ" },
            evidenceFound: 3,
            toJSON: () => ({ currentCase: "case-002" })
        },
        progressTracker: { caseSolved() {}, toJSON: () => ({}) },
        reputationSystem: { caseSolved() {}, toJSON: () => ({}) },
        alternateEndings: { determineEnding: () => null },
        achievementSystem: { checkAll() {} },
        _updateMainMenu() {},
        _saveProgress() { saves++; },
        _quickSave() { quickSaves++; }
    };
    const EventController = loadEventController({
        document: { getElementById: () => null },
        setInterval: () => 1,
        clearInterval() {}
    });
    const controller = new EventController(app, eventBus);
    controller.bind();

    eventBus.emit("case:solved", { caseId: "case-002" });

    assert.deepEqual(calls, [{ caseId: "case-002", outcome: "solved" }]);
    assert.deepEqual(app.progress.npcMemoryData, { currentCaseId: "case-002" });
    assert.equal(app.progress.solvedCases.includes("case-002"), true);
    assert.equal(quickSaves, 1);
    assert.ok(saves >= 1);
    controller.dispose();
});

test("EventController forwards readiness events to the app-facing UI state", () => {
    const eventBus = createEventBus();
    const area = {
        classList: {
            values: new Set(["hidden"]),
            add(value) { this.values.add(value); },
            remove(value) { this.values.delete(value); }
        }
    };
    const document = { getElementById(id) { return id === "final-answer-area" ? area : null; } };
    const EventController = loadEventController({ document, setInterval: () => 1, clearInterval() {} });
    const controller = new EventController({ currentScreen: "screen-case-active" }, eventBus);

    controller.bind();
    eventBus.emit("case:ready_for_final", true);
    assert.equal(area.classList.values.has("hidden"), false);

    eventBus.emit("case:ready_for_final", false);
    assert.equal(area.classList.values.has("hidden"), true);
    controller.dispose();
});

test("failed cases close once, preserve settled NPC promises and cannot be resumed", () => {
    const bus = createEventBus();
    const sequence = [];
    const continueButton = { classList: { add(name) { sequence.push("hide:" + name); } } };
    const app = {
        progress: { activeCase: "case-002", solvedCases: ["case-001"], failedCases: [] },
        caseManager: {
            currentCase: { id: "case-002", title: "Poisoning" }, caseState: "active",
            toJSON() { return { currentCaseId: "case-002", caseState: this.caseState }; }
        },
        npcMemoryService: {
            settlePromisesForCase(id, outcome) {
                sequence.push("settle:" + id + ":" + outcome);
                return [{ npcId: "waiter", status: "broken" }];
            },
            toJSON() { return { promise: "broken" }; }
        },
        progressTracker: {
            caseFailed() { sequence.push("stats"); },
            toJSON() { return { failed: 1 }; }
        },
        reputationSystem: {
            caseFailed() { sequence.push("reputation"); },
            toJSON() { return { trust: 30 }; }
        },
        _saveProgress() {},
        _quickSave() {
            sequence.push("save");
            assert.equal(this.progress.activeCase, null);
            assert.equal(this.progress.caseData.caseState, "failed");
            assert.deepEqual(this.progress.npcMemoryData, { promise: "broken" });
            return true;
        },
        _updateMainMenu() {}
    };
    const Controller = loadEventController({
        document: { getElementById(id) { return id === "btn-continue" ? continueButton : null; } },
        setInterval() { return 1; }, clearInterval() {}
    });
    new Controller(app, bus).bind();
    bus.emit("case:failed", { caseId: "case-002" });
    bus.emit("case:failed", { caseId: "case-002" });

    assert.equal(app.caseManager.caseState, "failed");
    assert.equal(app.progress.activeCase, null);
    assert.deepEqual([...app.progress.failedCases], ["case-002"]);
    assert.deepEqual(app.progress.solvedCases, ["case-001"]);
    assert.deepEqual(app.progress.trackerData, { failed: 1 });
    assert.deepEqual(sequence, [
        "settle:case-002:failed", "stats", "reputation", "hide:hidden", "save"
    ]);
});

test("starting the same case again clears run-scoped knowledge but retains persistent NPC profiles", () => {
    const bus = createEventBus();
    const profile = { trust: 43, memories: [{ type: "broken_promise" }] };
    const memory = {
        currentCaseId: "case-002",
        cases: { "case-002": { waiter: { claims: ["old clue"] } } },
        people: { waiter: profile },
        resetCase(id) { delete this.cases[id]; },
        setCase(id) { this.currentCaseId = id; this.cases[id] ??= {}; },
        toJSON() { return { cases: this.cases, people: this.people }; }
    };
    const scoped = () => ({
        cases: { "case-002": { old: true } },
        resetCase(id) { delete this.cases[id]; },
        setCase(caseData) { this.cases[caseData.id] ??= {}; },
        setMotivationService() {},
        setRelationshipService() {},
        setDependencies() {},
        toJSON() { return { cases: this.cases }; }
    });
    const board = {
        caseId: "case-002",
        hypotheses: ["previous deduction"],
        setCase(id) {
            if (this.caseId === id) return;
            this.caseId = id;
            this.hypotheses = [];
        },
        toJSON() { return { caseId: this.caseId, hypotheses: this.hypotheses }; }
    };
    const app = {
        progress: {},
        caseManager: { currentCase: { id: "case-002" }, toJSON: () => ({ caseState: "active" }) },
        investigationBoard: board,
        boardUI: { render() {} },
        npcMemoryService: memory,
        npcMotivationService: { setMemoryService() {}, setCase() {} },
        npcSocialNetwork: scoped(),
        npcRelationshipService: scoped(),
        npcManager: { setMemoryService() {}, setSocialNetwork() {}, setRelationshipService() {}, loadNPCsForCase() {} },
        npcListUI: { render() {} },
        progressTracker: { startCase() {} },
        evidenceChainSystem: { loadChainsForCase() {}, checkChains() {} },
        notesManager: { collectNote() {} },
        _saveProgress() {}
    };
    const EventController = loadEventController({
        setInterval: () => 1, clearInterval() {}, setTimeout() {}
    });
    new EventController(app, bus).bind();
    bus.emit("case:started", { caseData: { id: "case-002" } });

    assert.deepEqual(Object.keys(memory.cases["case-002"]), []);
    assert.equal(memory.people.waiter, profile);
    assert.deepEqual(Object.keys(app.npcSocialNetwork.cases["case-002"]), []);
    assert.deepEqual(Object.keys(app.npcRelationshipService.cases["case-002"]), []);
    assert.deepEqual(board.hypotheses, []);
    assert.equal(board.caseId, "case-002");
    assert.equal(app.progress.activeCase, "case-002");
});

test("a false public accusation harms Anna once and survives a memory reload", () => {
    const eventBus = createEventBus();
    const context = vm.createContext({
        console,
        setInterval: () => 1,
        clearInterval() {},
        assessAccusationEvidence: (_case, inventory) => ({ sufficient: inventory.proofReady })
    });
    vm.runInContext(
        readFileSync(resolve(root, "assets/js/npc/npcMemoryService.js"), "utf8") +
        "\n;globalThis.TestMemoryService = NPCMemoryService;",
        context
    );
    vm.runInContext(
        readFileSync(resolve(root, "assets/js/controllers/eventController.js"), "utf8") +
        "\n;globalThis.TestEventController = EventController;",
        context
    );
    vm.runInContext(
        readFileSync(resolve(root, "assets/js/systems/reputation.js"), "utf8") +
        "\n;globalThis.TestReputationSystem = ReputationSystem;",
        context
    );
    const memory = new context.TestMemoryService(null, "case-002");
    const caseData = {
        id: "case-002",
        deductionSuspects: [{ id: "ex_wife" }, { id: "business_rival" }],
        correctDeduction: { suspect: "business_rival" },
        finalQuestion: { acceptableAnswers: [] }
    };
    const published = [];
    const app = {
        progress: {},
        inventory: { proofReady: false },
        caseManager: { currentCase: caseData },
        npcMemoryService: memory,
        reputationSystem: new context.TestReputationSystem(),
        npcSocialNetwork: {
            publishPublicAccusation(npcId, id) {
                published.push({ npcId, id });
                return { published: true, queued: 1 };
            },
            toJSON() { return { pending: ["public-accusation"] }; }
        },
        _saveProgress() {}
    };
    new context.TestEventController(app, eventBus).bind();
    const baseline = memory.getLongTermProfile("ex_wife").trust;
    eventBus.emit("deduction:attempted", { caseId: "case-002" });
    eventBus.emit("deduction:public_accusation", { caseId: "case-002", suspectId: "ex_wife" });
    assert.equal(memory.getAccusations("ex_wife").length, 0, "blocked when proof is missing");

    app.inventory.proofReady = true;
    eventBus.emit("deduction:public_accusation", { caseId: "case-002", suspectId: "business_rival" });
    assert.equal(memory.getAccusations("business_rival").length, 0, "correct suspect is not punished");

    eventBus.emit("deduction:public_accusation", { caseId: "case-001", suspectId: "ex_wife" });
    eventBus.emit("deduction:public_accusation", { caseId: "case-002", suspectId: "unknown" });
    assert.equal(memory.getAccusations("ex_wife").length, 0, "invalid case and suspect ignored");

    eventBus.emit("deduction:public_accusation", { caseId: "case-002", suspectId: "ex_wife" });
    const after = memory.getTrust("ex_wife");
    assert.equal(memory.getAccusationStatus("ex_wife", "public-final-accusation:case-002:ex_wife"), "false");
    assert.equal(app.reputationSystem.getFactionReputation("residents"), 42,
        "a proven false public accusation damages residents' confidence once");
    assert.equal(app.reputationSystem.getFactionReputation("witnesses"), 40,
        "witnesses become less willing to trust the detective");
    assert.equal(app.progress.reputationData.factionReputation.police, 50);
    assert.equal(app.progress.reputationData.factionReputation.press, 50);
    assert.equal(app.progress.reputationData.factionReputation.residents, 42);
    assert.equal(app.progress.reputationData.factionReputation.witnesses, 40);
    assert.equal(app.progress.reputationData.factionReputation.underworld, 50,
        "the faction consequences are included in the next save");
    assert.ok(after < 50, "Anna's current trust decreases");
    assert.ok(memory.getLongTermProfile("ex_wife").trust < baseline, "long-term trust decreases");
    const stored = memory.toJSON();
    eventBus.emit("deduction:public_accusation", { caseId: "case-002", suspectId: "ex_wife" });
    assert.equal(memory.getTrust("ex_wife"), after, "repeating the declaration cannot stack penalties");
    assert.equal(app.reputationSystem.getFactionReputation("residents"), 42);
    assert.equal(app.reputationSystem.getFactionReputation("witnesses"), 40,
        "repeating the same public accusation cannot stack faction penalties");
    assert.equal(memory.getAccusations("ex_wife").length, 1);
    assert.equal(published.length, 1, "only the verified and first accusation seeds a rumor");
    assert.equal(published[0].npcId, "ex_wife");
    assert.deepEqual(app.progress.npcSocialData, { pending: ["public-accusation"] });
    const restored = new context.TestMemoryService(stored, "case-002");
    assert.equal(restored.getAccusationStatus("ex_wife", "public-final-accusation:case-002:ex_wife"), "false");
    assert.equal(restored.getTrust("ex_wife"), after);
    assert.ok(eventBus.emitted.some(event =>
        event.name === "npc:memory_changed" && event.payload?.reason === "public_false_accusation"));
});


test("keeping the witness-protection promise improves witness and resident reputation once", () => {
    const eventBus = createEventBus();
    const changes = [];
    const app = {
        progress: {},
        npcMemoryService: {
            getPromises(npcId) {
                return npcId === "waiter" ? [{
                    id: "thomas-family-protection",
                    fulfillment: { type: "insight_gained", insightId: "thomas_family_protected" }
                }] : [];
            }
        },
        reputationSystem: {
            applied: new Set(),
            changeFactionReputation(...args) {
                if (this.applied.has(args[3])) return { changed: false, reason: "already_applied" };
                this.applied.add(args[3]);
                changes.push(args);
                return { changed: true };
            },
            toJSON() { return { saved: true }; }
        }
    };
    const EventController = loadEventController();
    const controller = new EventController(app, eventBus);
    const resolved = [{ npcId: "waiter", promiseId: "thomas-family-protection", status: "fulfilled" }];
    controller._notifyPromiseChanges(resolved);
    controller._notifyPromiseChanges(resolved);

    assert.equal(changes.length, 2, "duplicate notification must not reapply consequences");
    assert.equal(changes[0][0], "witnesses");
    assert.equal(changes[0][1], 5);
    assert.equal(changes[0][3], "thomas-family-protection:fulfilled:witnesses");
    assert.equal(changes[1][0], "residents");
    assert.equal(changes[1][1], 3);
    assert.deepEqual(app.progress.reputationData, { saved: true });
    assert.equal(eventBus.emitted.filter(item => item.name === "npc:memory_changed").length, 2);
});

test("breaking the witness-protection promise harms witness and resident reputation", () => {
    const eventBus = createEventBus();
    const changes = [];
    const app = {
        progress: {},
        npcMemoryService: {
            getPromises: () => [{
                id: "thomas-family-protection",
                fulfillment: { type: "insight_gained", insightId: "thomas_family_protected" }
            }]
        },
        reputationSystem: {
            applied: new Set(),
            changeFactionReputation(...args) {
                if (this.applied.has(args[3])) return { changed: false, reason: "already_applied" };
                this.applied.add(args[3]);
                changes.push(args);
                return { changed: true };
            },
            toJSON: () => ({ saved: true })
        }
    };
    const EventController = loadEventController();
    const controller = new EventController(app, eventBus);
    controller._notifyPromiseChanges([
        { npcId: "waiter", promiseId: "thomas-family-protection", status: "broken" }
    ]);

    assert.equal(changes.length, 2);
    assert.deepEqual(changes.map(change => [change[0], change[1]]), [
        ["witnesses", -8], ["residents", -5]
    ]);
});

test("unrelated NPC promises do not change community reputation", () => {
    const eventBus = createEventBus();
    const changes = [];
    const app = {
        progress: {},
        npcMemoryService: { getPromises: () => [] },
        reputationSystem: { changeFactionReputation(...args) { changes.push(args); } }
    };
    const EventController = loadEventController();
    new EventController(app, eventBus)._notifyPromiseChanges([
        { npcId: "journalist", promiseId: "publish-the-truth", status: "fulfilled" },
        { npcId: "waiter", promiseId: "thomas-family-protection", status: "pending" }
    ]);
    assert.equal(changes.length, 0);
});


test("duplicate solve events never duplicate ending, rewards, statistics or promise settlement", () => {
    const bus = createEventBus();
    const calls = [];
    const app = {
        progress: { activeCase: "case-002", activeRunId: "case-002:run-1", solvedCases: [], failedCases: [] },
        caseManager: {
            currentCase: { id: "case-002", title: "Последний заказ" },
            caseState: "active",
            evidenceFound: 6,
            toJSON() { return { caseState: this.caseState, currentCaseId: "case-002" }; }
        },
        npcMemoryService: {
            settlePromisesForCase(id, outcome) { calls.push("promises:" + id + ":" + outcome); return []; },
            toJSON() { return { settled: true }; }
        },
        alternateEndings: {
            determineEnding() { calls.push("ending"); return { title: "Полная правда", bonusReputation: 5, unlocks: ["archive"] }; }
        },
        progressTracker: { activeRunId: "case-002:run-1", caseSolved() { calls.push("stats"); this.activeRunId = null; }, toJSON: () => ({ solved: 1 }) },
        reputationSystem: { caseSolved(_caseData, bonus) { calls.push("reputation:" + bonus); }, toJSON: () => ({ reputation: 55 }) },
        locationManager: { unlockLocation(id) { calls.push("unlock:" + id); } },
        achievementSystem: { checkAll() { calls.push("achievements"); } },
        caseListUI: { setProgress() {} },
        _updateMainMenu() {},
        _quickSave() { calls.push("save"); }
    };
    const Controller = loadEventController({
        document: { getElementById: () => null },
        setTimeout(callback) { callback(); },
        setInterval: () => 1,
        clearInterval() {}
    });
    const controller = new Controller(app, bus);
    controller.bind();

    bus.emit("case:solved", { caseId: "case-002" });
    bus.emit("case:solved", { caseId: "case-002" });

    assert.equal(app.progress.activeCase, null);
    assert.deepEqual([...app.progress.solvedCases], ["case-002"]);
    for (const once of ["ending", "stats", "reputation:5", "unlock:archive"]) {
        assert.equal(calls.filter(call => call === once).length, 1, once + " is applied once");
    }
    assert.equal(calls.filter(call => call === "promises:case-002:solved").length, 1,
        "a duplicate completion event must not settle promises twice");
    assert.equal(calls.filter(call => call === "save").length, 1,
        "a duplicate completion event does not write a second snapshot");
    controller.dispose();
});


test("a replay gets a new run ID and ending while permanent rewards remain first-clear only", () => {
    const bus = createEventBus();
    const endings = [];
    const trackerRuns = [];
    const rewards = [];
    const app = {
        progress: { activeCase: "case-002", solvedCases: ["case-002"], completedRunIds: [], activeRunId: "case-002:run-2" },
        caseManager: {
            currentCase: { id: "case-002", title: "Последний заказ" },
            caseState: "active",
            evidenceFound: 5,
            toJSON() { return { caseState: this.caseState }; }
        },
        npcMemoryService: { settlePromisesForCase() { return []; } },
        alternateEndings: { determineEnding() { endings.push("ending"); return { id: "perfect", bonusReputation: 10, unlocks: ["secret_archive"] }; } },
        progressTracker: { activeRunId: "case-002:run-2", caseSolved(_data, runId) { trackerRuns.push(runId); }, toJSON: () => ({ history: trackerRuns }) },
        reputationSystem: { caseSolved() { rewards.push("first-clear"); }, addReputation() { rewards.push("bonus"); }, toJSON: () => ({}) },
        locationManager: { unlockLocation() { rewards.push("unlock"); } },
        achievementSystem: { checkAll() {} },
        caseListUI: { setProgress() {} },
        _updateMainMenu() {},
        _quickSave() {}
    };
    const Controller = loadEventController({
        document: { getElementById: () => null },
        setTimeout(callback) { callback(); },
        setInterval: () => 1, clearInterval() {}
    });
    const controller = new Controller(app, bus);
    controller.bind();

    bus.emit("case:solved", { caseId: "case-002" });
    bus.emit("case:solved", { caseId: "case-002" });

    assert.deepEqual(endings, ["ending"], "one ending is generated for the new playthrough");
    assert.deepEqual(trackerRuns, ["case-002:run-2"], "the run is recorded exactly once");
    assert.deepEqual(rewards, [], "first-clear progression rewards are not farmable on replay");
    assert.deepEqual([...app.progress.completedRunIds], ["case-002:run-2"]);
    controller.dispose();
});


test("EventController queues a second narrative modal until the first Bootstrap transition is hidden", () => {
    const eventBus = createEventBus();
    const listeners = new Map();
    const classes = new Set();
    const modalElement = {
        classList: {
            contains(name) { return classes.has(name); },
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); }
        },
        addEventListener(name, handler) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(handler);
        },
        removeEventListener(name, handler) { listeners.get(name)?.delete(handler); },
        dispatch(name) {
            for (const handler of listeners.get(name) || []) handler();
        }
    };
    const elements = {
        "universal-modal": modalElement,
        "modal-title": { innerHTML: "" },
        "modal-body": { innerHTML: "" },
        "modal-footer": { innerHTML: "" }
    };
    let showCalls = 0;
    const EventController = loadEventController({
        document: { getElementById: id => elements[id] || null },
        bootstrap: {
            Modal: {
                getOrCreateInstance() {
                    return { show() { showCalls++; classes.add("show"); } };
                }
            }
        },
        setInterval: () => 1,
        clearInterval() {}
    });
    const controller = new EventController({ progress: null }, eventBus);
    controller.bind();

    eventBus.emit("modal:show", { title: "Первое окно", body: "Текст 1", footer: "Закрыть" });
    assert.equal(showCalls, 1);
    assert.equal(elements["modal-title"].innerHTML, "Первое окно");

    // Bootstrap removes .show as soon as hide starts, but keeps its backdrop
    // until the transition completes. A class-only check would miss this race.
    modalElement.dispatch("hide.bs.modal");
    classes.delete("show");
    eventBus.emit("modal:show", { title: "Второе окно", body: "Текст 2", footer: "Продолжить" });
    assert.equal(showCalls, 1, "Bootstrap must not be asked to show while the previous hide transition is running");
    assert.equal(elements["modal-title"].innerHTML, "Первое окно");

    modalElement.dispatch("hidden.bs.modal");
    assert.equal(showCalls, 2);
    assert.equal(classes.has("show"), true);
    assert.equal(elements["modal-title"].innerHTML, "Второе окно");
    assert.equal(elements["modal-body"].innerHTML, "Текст 2");

    controller.dispose();
    assert.equal(listeners.get("hidden.bs.modal").size, 0);
});


test("failed case reputation receives the resolved case data and is applied only once", () => {
    const bus = createEventBus();
    const received = [];
    const app = {
        progress: { activeCase: "case-002", activeRunId: "case-002:failure-1", failedCases: [] },
        caseManager: {
            currentCase: { id: "case-002", title: "Последний заказ" },
            caseState: "active",
            toJSON() { return { id: "case-002", title: "Последний заказ", caseState: this.caseState }; }
        },
        progressTracker: {
            caseFailed(caseData, runId) { received.push({ type: "tracker", caseData, runId }); },
            toJSON() { return { failed: 1 }; }
        },
        reputationSystem: {
            caseFailed(caseData) { received.push({ type: "reputation", caseData }); },
            toJSON() { return { reputation: 40, lastReason: "Провалено дело: " + caseData.title }; }
        },
        caseArchiveUI: { setProgress() {} },
        caseListUI: { setProgress() {} },
        _updateMainMenu() {},
        _quickSave() {}
    };
    const Controller = loadEventController({
        document: { getElementById: () => null },
        setInterval() { return 1; },
        clearInterval() {}
    });
    const controller = new Controller(app, bus);
    controller.bind();

    bus.emit("case:failed", { caseId: "case-002" });
    bus.emit("case:failed", { caseId: "case-002" });

    assert.equal(received.filter(call => call.type === "reputation").length, 1);
    assert.equal(received[0].type, "tracker");
    assert.equal(received[1].type, "reputation");
    assert.equal(received[1].caseData, app.caseManager.currentCase,
        "reputation receives the canonical case object, not the event payload");
    assert.equal(received[1].caseData.title, "Последний заказ");
    assert.deepEqual(app.progress.reputationData, {
        reputation: 40,
        lastReason: "Провалено дело: Последний заказ"
    });
    assert.deepEqual([...app.progress.failedCases], ["case-002"]);
    assert.equal(app.progress.activeCase, null);
    controller.dispose();
});
