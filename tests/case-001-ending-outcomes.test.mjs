import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createEndingResolver(insights = [], evidenceCount = 0, socialContext = {}) {
    const registry = {};
    const context = vm.createContext({
        console: { log() {} },
        registerData(type, data) { registry[type] = { ...(registry[type] || {}), ...data }; },
        window: {}
    });
    vm.runInContext(readFileSync(resolve(root, "assets/data/cases/case-001/endings.js"), "utf8"), context);
    context.window.ENDINGS = registry.ending;
    vm.runInContext(readFileSync(resolve(root, "assets/js/systems/alternateEndings.js"), "utf8"), context);
    context.__testInsights = insights;
    context.__testEvidenceCount = evidenceCount;
    context.__testSocialContext = socialContext;
    return vm.runInContext(`(() => {
        const resolver = new AlternateEndings();
        const inventory = {
            insights: __testInsights,
            hasInsight(id) { return this.insights.includes(id); }
        };
        return resolver.determineEnding(
            { id: "case-001" }, inventory, __testEvidenceCount, __testSocialContext
        );
    })()`, context);
}

test("case one perfect ending requires confession and the independently discovered rescue location", () => {
    const ending = createEndingResolver(["mary_full_confession", "blackwood_location_revealed"], 8);
    assert.equal(ending.id, "case-001-perfect");
    assert.match(ending.text, /Блэквуда/);
});

test("case one confession without the rescue location cannot produce the perfect ending", () => {
    const ending = createEndingResolver(["mary_full_confession"], 8);
    assert.equal(ending.id, "case-001-partial");
    assert.notEqual(ending.id, "case-001-perfect");
});

test("case one evidence threshold produces the partial ending without a confession", () => {
    const ending = createEndingResolver([], 6);
    assert.equal(ending.id, "case-001-partial");
    assert.deepEqual(Array.from(ending.unlocks), ["train_station"]);
});

test("case one insufficient evidence produces the failed ending", () => {
    const ending = createEndingResolver([], 5);
    assert.equal(ending.id, "case-001-failed");
    assert.equal(ending.condition, "default");
});
