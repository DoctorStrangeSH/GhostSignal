import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function resolveCaseTwoEnding(insights = [], evidenceCount = 0, socialContext = {}) {
    const registry = {};
    const context = vm.createContext({
        console: { log() {} },
        registerData(type, data) {
            registry[type] = { ...(registry[type] || {}), ...data };
        },
        window: {}
    });

    for (const path of [
        "assets/data/cases/case-002/index.js",
        "assets/data/cases/case-002/endings.js",
        "assets/js/systems/alternateEndings.js"
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }

    context.window.ENDINGS = registry.ending;
    context.__insights = insights;
    context.__evidenceCount = evidenceCount;
    context.__socialContext = socialContext;

    return vm.runInContext(`(() => {
        const resolver = new AlternateEndings();
        const inventory = {
            insights: __insights,
            hasInsight(id) { return this.insights.includes(id); }
        };
        return resolver.determineEnding(
            CASE_002,
            inventory,
            __evidenceCount,
            __socialContext
        );
    })()`, context);
}

test("case two perfect ending requires the full confession insight", () => {
    const ending = resolveCaseTwoEnding(["full_confession_kane"], 2, { solved: true });

    assert.equal(ending.id, "case-002-perfect");
    assert.equal(ending.condition, "full_confession_kane");
    assert.match(ending.text, /Блэквуд выжил/);
    assert.match(ending.text, /Анна оправдана/);
});

test("case two partial ending is selected at four unique evidence items without a confession", () => {
    const ending = resolveCaseTwoEnding([], 4, { solved: true });

    assert.equal(ending.id, "case-002-partial");
    assert.equal(ending.condition, "evidence_count_4");
    assert.match(ending.text, /недостаточно для суда/);
});

test("case two failed ending is reserved for an unresolved run below the evidence threshold", () => {
    const ending = resolveCaseTwoEnding([], 3, { solved: false });

    assert.equal(ending.id, "case-002-failed");
    assert.equal(ending.condition, "default");
    assert.match(ending.text, /Кейн на свободе/);
});

test("a solved, evidence-gated case cannot fall into the authored failed ending", () => {
    const ending = resolveCaseTwoEnding(["hard_evidence_kane"], 3, { solved: true });

    assert.equal(ending.id, "case-002-partial");
    assert.notEqual(ending.id, "case-002-failed");
});

test("case two ending selection remains independent from NPC promise consequences", () => {
    const summary = {
        npcs: {
            waiter: {
                promises: { fulfilled: 1, broken: 0 },
                trust: 80,
                rumors: { disputed: 0 },
                accusations: { false: 0, pending: 0 }
            }
        }
    };
    const ending = resolveCaseTwoEnding(["full_confession_kane"], 2, {
        solved: true,
        npcMemoryService: { getCaseSocialSummary: () => summary }
    });

    assert.equal(ending.id, "case-002-perfect");
    assert.match(ending.text, /Томас сдержал обещание/);
    assert.equal(ending.socialConsequencesApplied, 1);
});
