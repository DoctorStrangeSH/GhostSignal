import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadSystem() {
    const emitted = [];
    const context = vm.createContext({
        events: { emit(name, payload) { emitted.push({ name, payload }); } }
    });
    vm.runInContext(readFileSync(resolve(root, "assets/js/systems/reputation.js"), "utf8") +
        "\n;globalThis.__exported = ReputationSystem;", context);
    return { ReputationSystem: context.__exported, emitted };
}

test("case completion applies the selected ending bonus once instead of stacking the generic solve reward", () => {
    const { ReputationSystem } = loadSystem();
    const reputation = new ReputationSystem();
    reputation.caseSolved({ title: "Исчезновение Блэквуда" }, 5);
    assert.equal(reputation.getReputation(), 55);
    assert.equal(reputation.actions.length, 1);
    assert.equal(reputation.actions[0].amount, 5);
});

test("perfect ending reputation bonus is applied once", () => {
    const { ReputationSystem } = loadSystem();
    const reputation = new ReputationSystem();
    reputation.caseSolved({ title: "Отравление в баре" }, 15);
    assert.equal(reputation.getReputation(), 65);
    assert.equal(reputation.actions.length, 1);
});

test("legacy callers retain the default solved-case reputation reward", () => {
    const { ReputationSystem } = loadSystem();
    const reputation = new ReputationSystem();
    reputation.caseSolved({ title: "Старое дело" });
    assert.equal(reputation.getReputation(), 65);
    assert.equal(reputation.actions.length, 1);
});
