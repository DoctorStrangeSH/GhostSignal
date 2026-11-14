import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");

function attributeValues(markup, tag, attribute) {
    const tags = markup.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) || [];
    return tags.flatMap(element => {
        const match = element.match(new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
        return match ? [match[1]] : [];
    });
}

function localReference(value) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
    const path = decodeURIComponent(value.split(/[?#]/, 1)[0]);
    const resolved = resolve(root, path);
    assert.ok(resolved.startsWith(root + sep), `Resource escapes project root: ${value}`);
    return resolved;
}

test("HTML boot resources exist and do not escape the project", () => {
    const references = [
        ...attributeValues(html, "script", "src"),
        ...attributeValues(html, "link", "href")
    ];
    assert.ok(references.length > 80, "Expected full game resource manifest");
    for (const reference of references) {
        const file = localReference(reference);
        if (file) assert.ok(existsSync(file), `Missing boot resource: ${reference}`);
    }
});

test("game boot scripts load once and in dependency order", () => {
    const scripts = attributeValues(html, "script", "src").filter(src => !/^(?:https?:)?\/\//.test(src));
    assert.equal(new Set(scripts).size, scripts.length, "Duplicate scripts can recreate state");
    const positions = [
        "assets/data/cases/case-001/index.js",
        "assets/data/cases/case-002/index.js",
        "assets/data/cases/case-index.js",
        "assets/js/systems/caseManager.js",
        "assets/js/controllers/navigationController.js",
        "assets/js/controllers/eventController.js",
        "assets/js/core/app.js"
    ].map(src => {
        const index = scripts.indexOf(src);
        assert.notEqual(index, -1, `Missing required boot script: ${src}`);
        return index;
    });
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    assert.equal(scripts.at(-1), "assets/js/core/app.js", "App must initialize last");
});

test("HTML IDs are unique and main menu controls are present", () => {
    const ids = [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, "Duplicate IDs make getElementById ambiguous");
    for (const required of [
        "screen-main-menu", "screen-cases", "cases-list", "btn-open-cases",
        "btn-continue", "btn-stats", "btn-options"
    ]) {
        assert.ok(ids.includes(required), `Missing main navigation element: ${required}`);
    }
    assert.match(html, /<section\s+id="screen-main-menu"\s+class="screen active"/);
});

test("the game entry point is wired to DOMContentLoaded", () => {
    const app = readFileSync(resolve(root, "assets/js/core/app.js"), "utf8");
    const navigation = readFileSync(resolve(root, "assets/js/controllers/navigationController.js"), "utf8");
    assert.match(app, /document\.addEventListener\(['"]DOMContentLoaded['"]/);
    assert.match(app, /window\.app\s*=\s*new App\(/);
    assert.match(navigation, /getElementById\(['"]btn-open-cases['"]\)/);
});
