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
