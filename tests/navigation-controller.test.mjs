import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadNavigationController(globals = {}) {
    const context = vm.createContext({ console, ...globals });
    const source = readFileSync(resolve(root, "assets/js/controllers/navigationController.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__exported = NavigationController;", context);
    return context.__exported;
}

function classList(initial = []) {
    const values = new Set(initial);
    return {
        add(value) { values.add(value); },
        remove(value) { values.delete(value); },
        contains(value) { return values.has(value); },
        values
    };
}

test("NavigationController changes screens and keeps App screen state in sync", () => {
    const screens = [
        { id: "screen-main-menu", classList: classList(["active"]) },
        { id: "screen-cases", classList: classList() }
    ];
    const document = {
        querySelectorAll(selector) {
            return selector === ".screen" ? screens : [];
        },
        getElementById(id) {
            return screens.find(screen => screen.id === id) || null;
        }
    };
    const app = { currentScreen: "screen-main-menu" };
    const NavigationController = loadNavigationController({ document });
    const navigation = new NavigationController(app);

    navigation.navigateTo("screen-cases");

    assert.equal(screens[0].classList.contains("active"), false);
    assert.equal(screens[1].classList.contains("active"), true);
    assert.equal(app.currentScreen, "screen-cases");
});

test("NavigationController switches tabs and renders the investigation board on demand", () => {
    const tabs = [
        { classList: classList(["active"]) },
        { classList: classList() }
    ];
    const panels = [
        { id: "tab-inventory", classList: classList(["active"]) },
        { id: "tab-board", classList: classList() }
    ];
    const document = {
        querySelectorAll(selector) {
            if (selector === ".sidebar-tab") return tabs;
            if (selector === ".tab-panel") return panels;
            return [];
        },
        querySelector(selector) {
            return selector === '[data-tab="tab-board"]' ? tabs[1] : null;
        },
        getElementById(id) {
            return panels.find(panel => panel.id === id) || null;
        }
    };
    let renders = 0;
    const app = { boardUI: { render() { renders++; } } };
    const NavigationController = loadNavigationController({ document });
    const navigation = new NavigationController(app);

    navigation.switchTab("tab-board");

    assert.equal(tabs[0].classList.contains("active"), false);
    assert.equal(tabs[1].classList.contains("active"), true);
    assert.equal(panels[0].classList.contains("active"), false);
    assert.equal(panels[1].classList.contains("active"), true);
    assert.equal(renders, 1);

    navigation.switchTab("tab-inventory");
    assert.equal(renders, 1);
});

test("hint button snapshots reputation and clue state immediately", () => {
    const listeners = new Map();
    let snapshots = 0;
    let reputation = 0;
    let hints = 0;
    const document = {
        getElementById(id) {
            return id === "btn-hint" ? { addEventListener(name, handler) { listeners.set(name, handler); } } : null;
        },
        querySelectorAll() { return []; }
    };
    const emitted = [];
    const NavigationController = loadNavigationController({
        document,
        events: { emit(name, data) { emitted.push({ name, data }); } }
    });
    const app = {
        caseManager: { currentCase: { finalQuestion: { hint: "Inspect the letter" } } },
        reputationSystem: { usedHint() { reputation++; } },
        progressTracker: { useHint() { hints++; }, toJSON() { return { hints }; } },
        progress: {},
        _quickSave() { snapshots++; }
    };
    new NavigationController(app).bindNavigation();
    listeners.get("click")();

    assert.equal(reputation, 1);
    assert.equal(hints, 1);
    assert.deepEqual(app.progress.trackerData, { hints: 1 });
    assert.equal(snapshots, 1);
    assert.equal(emitted[0].name, "modal:show");
});

test("NavigationController preserves main-menu keyboard shortcuts", () => {
    const listeners = new Map();
    const clicks = [];
    const buttons = new Map(["btn-open-cases", "btn-continue", "btn-stats", "btn-options"].map(id => [
        id,
        { click() { clicks.push(id); }, classList: classList() }
    ]));
    const document = {
        addEventListener(name, callback) { listeners.set(name, callback); },
        getElementById(id) { return buttons.get(id) || null; }
    };
    const app = { currentScreen: "screen-main-menu" };
    const NavigationController = loadNavigationController({ document });
    const navigation = new NavigationController(app);

    navigation.bindKeyboard();
    listeners.get("keydown")({ key: "1" });
    listeners.get("keydown")({ key: "3" });
    listeners.get("keydown")({ key: "4" });

    assert.deepEqual(clicks, ["btn-open-cases", "btn-stats", "btn-options"]);
});

test("NavigationController keeps quick-save shortcut delegated to App", () => {
    let listener;
    let saves = 0;
    const document = {
        addEventListener(name, callback) {
            if (name === "keydown") listener = callback;
        },
        querySelector() { return null; }
    };
    const app = {
        currentScreen: "screen-case-active",
        _quickSave() { saves++; }
    };
    const NavigationController = loadNavigationController({
        document,
        bootstrap: { Modal: { getInstance() { return null; } } }
    });
    const navigation = new NavigationController(app);
    navigation.bindGlobalShortcuts();

    let prevented = false;
    listener({ key: "s", ctrlKey: true, preventDefault() { prevented = true; } });

    assert.equal(prevented, true);
    assert.equal(saves, 1);
});

test("continue button appears on menu return after opening a case", () => {
    const continueButton = { classList: classList(["hidden"]) };
    const menu = { id: "screen-main-menu", classList: classList() };
    const cases = { id: "screen-cases", classList: classList(["active"]) };
    const document = {
        querySelectorAll(selector) { return selector === ".screen" ? [menu, cases] : []; },
        getElementById(id) {
            return id === "btn-continue" ? continueButton :
                [menu, cases].find(screen => screen.id === id) || null;
        }
    };
    const app = {
        progress: { activeCase: "case-001" },
        caseManager: { currentCase: { id: "case-001" }, caseState: "active" },
        currentScreen: "screen-cases"
    };
    const navigation = new (loadNavigationController({ document }))(app);
    navigation.navigateTo("screen-main-menu");

    assert.equal(continueButton.classList.contains("hidden"), false);
    assert.equal(app.currentScreen, "screen-main-menu");

    app.progress.activeCase = null;
    navigation.navigateTo("screen-main-menu");
    assert.equal(continueButton.classList.contains("hidden"), true);
});

test("continue button stays hidden for a finished or mismatched case", () => {
    const continueButton = { classList: classList() };
    const document = { getElementById() { return continueButton; } };
    const app = {
        progress: { activeCase: "case-002" },
        caseManager: { currentCase: { id: "case-001" }, caseState: "active" }
    };
    const navigation = new (loadNavigationController({ document }))(app);

    navigation.syncContinueButton();
    assert.equal(continueButton.classList.contains("hidden"), true);
    app.caseManager.currentCase.id = "case-002";
    app.caseManager.caseState = "solved";
    navigation.syncContinueButton();
    assert.equal(continueButton.classList.contains("hidden"), true);
});

test("Continue click never starts a completed investigation", () => {
    let continueClick;
    const document = {
        getElementById(id) {
            return id === "btn-continue" ? {
                addEventListener(type, listener) { if (type === "click") continueClick = listener; }
            } : null;
        },
        querySelectorAll() { return []; }
    };
    const NavigationController = loadNavigationController({ document });
    const loaded = [];
    const app = {
        progress: { activeCase: "case-001" },
        caseController: { canResume: () => false },
        loadCase(id) { loaded.push(id); }
    };
    new NavigationController(app).bindNavigation();
    assert.equal(typeof continueClick, "function");
    continueClick();
    assert.deepEqual(loaded, []);

    app.caseController.canResume = () => true;
    continueClick();
    assert.deepEqual(loaded, ["case-001"]);
});
