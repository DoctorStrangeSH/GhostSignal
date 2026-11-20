import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createScreen() {
    const container = {
        innerHTML: "",
        querySelector() { return { addEventListener() {} }; }
    };
    const context = vm.createContext({ document: { getElementById: () => container } });
    const source = readFileSync(resolve(root, "assets/js/ui/statsScreen.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__StatsScreen = StatsScreen;", context);
    return { screen: new context.__StatsScreen("screen-stats"), container };
}

test("detective statistics render five independent community reputation standings", () => {
    const { screen, container } = createScreen();
    screen.setTracker({ getStats: () => ({
        rank: { name: "Стажёр" }, stars: 1, nextRank: { name: "Детектив", need: 2 },
        totalCasesSolved: 1, totalCasesFailed: 0, solveRate: 100, totalAttempts: 1,
        formattedTime: "00:20", averageTime: 20, totalHintsUsed: 0, casesHistory: []
    }) });
    screen.setReputation({
        getFactionStanding(id) {
            const scores = { police: 82, press: 64, residents: 43, witnesses: 28, underworld: 12 };
            const labels = { police: "Высокое доверие", press: "Хорошая репутация", residents: "Нейтральное отношение", witnesses: "Настороженность", underworld: "Плохая репутация" };
            return { score: scores[id], label: labels[id] };
        }
    });
    screen.render();
    for (const name of ["Полиция", "Пресса", "Жители", "Свидетели", "Преступный мир"]) assert.match(container.innerHTML, new RegExp(name));
    for (const score of ["82/100", "64/100", "43/100", "28/100", "12/100"]) assert.ok(container.innerHTML.includes(score));
    assert.match(container.innerHTML, /aria-valuenow="82"/);
    assert.match(container.innerHTML, /РЕПУТАЦИЯ СРЕДИ СООБЩЕСТВ/);
});

test("statistics screen remains compatible when community reputation is unavailable", () => {
    const { screen, container } = createScreen();
    screen.setTracker({ getStats: () => ({
        rank: { name: "Стажёр" }, stars: 0, nextRank: null,
        totalCasesSolved: 0, totalCasesFailed: 0, solveRate: 0, totalAttempts: 0,
        formattedTime: "00:00", averageTime: 0, totalHintsUsed: 0, casesHistory: []
    }) });
    screen.setReputation(null);
    screen.render();
    assert.doesNotMatch(container.innerHTML, /РЕПУТАЦИЯ СРЕДИ СООБЩЕСТВ/);
    assert.match(container.innerHTML, /СТАТИСТИКА ДЕТЕКТИВА/);
});
