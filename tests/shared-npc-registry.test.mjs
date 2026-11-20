import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const html = readFileSync(resolve("index.html"), "utf8");
const dataScripts = html.split("<script src=").slice(1)
    .map(chunk => chunk.match(/^[\"']([^\"']+)[\"']/)?.[1])
    .filter(path => path?.startsWith("assets/data/") && path.endsWith(".js"));

test("recurring NPC profiles load once from shared data before both case packs", () => {
    const sharedIndex = dataScripts.indexOf("assets/data/shared/npcs.js");
    const sharedBartenderDialogueIndex = dataScripts.indexOf("assets/data/shared/dialogues/bartender.js");
    const sharedSergeantDialogueIndex = dataScripts.indexOf("assets/data/shared/dialogues/sergeant.js");
    const caseOneIndex = dataScripts.indexOf("assets/data/cases/case-001/npcs.js");
    const caseTwoIndex = dataScripts.indexOf("assets/data/cases/case-002/npcs.js");

    assert.notEqual(sharedIndex, -1, "shared NPC registry must be included in index.html");
    assert.ok(sharedIndex < caseOneIndex, "shared profiles must load before case 1");
    assert.ok(sharedIndex < caseTwoIndex, "shared profiles must load before case 2");
    assert.ok(sharedBartenderDialogueIndex > sharedIndex && sharedBartenderDialogueIndex < caseOneIndex);
    assert.ok(sharedSergeantDialogueIndex > sharedIndex && sharedSergeantDialogueIndex < caseOneIndex);
    assert.ok(!dataScripts.includes("assets/data/cases/case-001/dialogues/bartender.js"));
    assert.ok(!dataScripts.includes("assets/data/cases/case-001/dialogues/sergeant.js"));

    const caseOneSource = readFileSync(resolve("assets/data/cases/case-001/npcs.js"), "utf8");
    const caseTwoSource = readFileSync(resolve("assets/data/cases/case-002/npcs.js"), "utf8");
    assert.doesNotMatch(caseOneSource, /^\s*(?:bartender|sergeant):\s*\{/m);
    assert.doesNotMatch(caseTwoSource, /^\s*(?:bartender|sergeant):\s*\{/m);

    const sandbox = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        window: {}
    });
    for (const scriptPath of dataScripts) {
        const source = readFileSync(resolve(scriptPath), "utf8");
        vm.runInContext(source, sandbox, { filename: scriptPath });
    }

    const sharedProfiles = ["bartender", "sergeant"];
    for (const id of sharedProfiles) {
        assert.equal(sandbox.window.NPCS_INDEX[id]?.id, id);
        assert.ok(vm.runInContext(`CASES_INDEX["case-001"].npcs.includes("${id}")`, sandbox));
        assert.ok(vm.runInContext(`CASES_INDEX["case-002"].npcs.includes("${id}")`, sandbox));
    }
    assert.equal(Object.keys(sandbox.window.NPCS_INDEX).filter(id => sharedProfiles.includes(id)).length, 2);
    assert.equal(sandbox.window.DIALOGUES_INDEX["dialogue-bartender"]?.npcId, "bartender");
    assert.equal(sandbox.window.DIALOGUES_INDEX["dialogue-sergeant"]?.npcId, "sergeant");
});
