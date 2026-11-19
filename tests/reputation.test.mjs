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
    const source = readFileSync(resolve(root, "assets/js/systems/reputation.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__exported = ReputationSystem;", context);
    return { ReputationSystem: context.__exported, emitted };
}

test("community reputation is independent across groups and bounded", () => {
    const { ReputationSystem, emitted } = loadSystem();
    const reputation = new ReputationSystem();
    assert.equal(reputation.getFactionReputation("police"), 50);
    assert.equal(reputation.getFactionReputation("residents"), 50);

    const police = reputation.changeFactionReputation("police", 25, "Помощь сержанту", "case-1-police-help");
    const residents = reputation.changeFactionReputation("residents", -35, "Публичное давление", "case-1-public-pressure");

    assert.equal(police.score, 75);
    assert.equal(police.standing.status, "favorable");
    assert.equal(residents.score, 15);
    assert.equal(residents.standing.status, "hostile");
    assert.equal(reputation.getFactionReputation("press"), 50);
    assert.equal(emitted.length, 2);
    assert.equal(emitted[0].name, "reputation:faction_changed");
});

test("community reputation event IDs prevent duplicate consequences", () => {
    const { ReputationSystem } = loadSystem();
    const reputation = new ReputationSystem();
    assert.equal(reputation.changeFactionReputation("witnesses", -12, "Обвинение", "accusation-7").changed, true);
    const duplicate = reputation.changeFactionReputation("witnesses", -12, "Повтор события", "accusation-7");
    assert.equal(duplicate.changed, false);
    assert.equal(duplicate.reason, "already_applied");
    assert.equal(reputation.getFactionReputation("witnesses"), 38);
});

test("community reputation validates faction IDs and clamps scores", () => {
    const { ReputationSystem } = loadSystem();
    const reputation = new ReputationSystem();
    assert.equal(reputation.changeFactionReputation("unknown", 10).reason, "invalid_change");
    assert.equal(reputation.changeFactionReputation("underworld", 1000).score, 100);
    assert.equal(reputation.changeFactionReputation("underworld", -1000).score, 0);
    assert.equal(reputation.getFactionStanding("missing"), null);
});

test("community reputation and its idempotency ledger survive save/load", () => {
    const { ReputationSystem } = loadSystem();
    const reputation = new ReputationSystem();
    reputation.changeFactionReputation("press", -20, "Сокрытие фактов", "case-2-press");
    reputation.changeFactionReputation("police", 15, "Сотрудничество", "case-2-police");
    const loaded = ReputationSystem.fromJSON(JSON.parse(JSON.stringify(reputation.toJSON())));
    assert.equal(loaded.getFactionReputation("press"), 30);
    assert.equal(loaded.getFactionReputation("police"), 65);
    assert.equal(loaded.actions.length, 2);
    assert.equal(loaded.changeFactionReputation("press", -20, "duplicate", "case-2-press").reason, "already_applied");
});

test("legacy reputation saves receive neutral community defaults", () => {
    const { ReputationSystem } = loadSystem();
    const loaded = ReputationSystem.fromJSON({ reputation: 72, npcRelations: { waiter: 4 } });
    assert.equal(loaded.getReputation(), 72);
    assert.equal(loaded.getFactionReputation("police"), 50);
    assert.equal(loaded.getFactionReputation("residents"), 50);
    assert.equal(loaded.getFactionStanding("residents").status, "neutral");
});
