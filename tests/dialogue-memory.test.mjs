import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createDialogueHarness() {
    const registry = { dialogue: {} };
    const emitted = [];
    const context = vm.createContext({
        console,
        Date,
        CONFIG: { time: { costs: { dialogue: 1 } } },
        events: { emit(name, payload) { emitted.push({ name, payload }); } },
        registerData(type, data) {
            if (type === "dialogue" && data.id) registry.dialogue[data.id] = data;
            else registry[type] = { ...(registry[type] || {}), ...data };
        },
        getDialogueById(id) { return registry.dialogue?.[id] || null; },
        getObjectById(id) { return ({ bar_photo: { id, name: "Фотография из бара", icon: "📸", isEvidence: true }, poison_vial: { id, name: "Пузырёк с ядом", isEvidence: true } })[id] || null; }
    });

    for (const path of [
        "assets/js/npc/npcMemoryService.js",
        "assets/js/npc/dialogueEngine.js",
        "assets/data/cases/case-002/dialogues/waiter.js",
        "assets/data/cases/case-002/dialogues/bartender_case2.js",
        "assets/data/cases/case-002/dialogues/rival.js"
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), "utf8"), context, { filename: path });
    }

    const setup = vm.runInContext(`(() => {
        const inventory = {
            evidence: ["bar_photo", "poison_vial"],
            items: ["bar_photo", "poison_vial"],
            insights: [],
            getEvidence() { return this.evidence.map(id => ({ id, name: id, icon: "📄", isEvidence: true })); },
            getAllItems() { return this.items.map(id => ({ id, name: id, icon: "📄", isEvidence: true })); },
            hasItem(id) { return this.items.includes(id); },
            hasInsight(id) { return this.insights.includes(id); },
            addInsight(id) { if (!this.insights.includes(id)) this.insights.push(id); }
        };
        const memory = new NPCMemoryService(null, "case-002");
        const engine = new DialogueEngine(inventory, { advance() {} });
        engine.setMemoryService(memory);
        return { inventory, memory, engine };
    })()`, context);

    return { ...setup, emitted, context };
}

test("DialogueEngine persists NPC conversation history and answer tone", () => {
    const { engine, memory } = createDialogueHarness();

    assert.equal(engine.startDialogue("dialogue-waiter"), true);
    engine.selectAnswer(0);
    engine.selectAnswer(0);

    const saved = memory.getMemory("waiter");
    assert.equal(saved.conversations, 1);
    assert.ok(saved.dialogueHistory.some(entry => entry.nodeId === "what_next"));
    assert.ok(saved.dialogueHistory.some(entry => entry.type === "answer" && entry.tone === "calm"));
    assert.equal(saved.trust, 52);
});

test("DialogueEngine records a promise made to Thomas as a pending NPC memory", () => {
    const { engine, memory } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.selectAnswer(0);

    const promiseAnswer = engine.getAvailableAnswers()[0];
    assert.equal(promiseAnswer.isAvailable, true);
    engine.selectAnswer(0);

    const promises = memory.getPromises("waiter");
    assert.equal(promises.length, 1);
    assert.equal(promises[0].id, "thomas-family-protection");
    assert.equal(promises[0].status, "pending");
    assert.equal(promises[0].fulfillment.type, "insight_gained");
    assert.equal(promises[0].fulfillment.insightId, "full_confession_kane");
    assert.equal(memory.getMemory("waiter").dialogueHistory.some(entry => entry.type === "promise_made"), true);
});

test("DialogueEngine lets Thomas's intimidation report unlock Joe's reaction", () => {
    const { engine, memory } = createDialogueHarness();

    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(1);

    assert.equal(memory.hasRumor("bartender", "detective-threatened-thomas"), true);
    assert.equal(memory.hasRumor("waiter", "detective-threatened-thomas"), false);
    assert.equal(memory.getRumors("bartender")[0].status, "unverified");
    assert.equal(memory.getRumors("bartender")[0].sourceTrust, 80);
    assert.equal(memory.getRumors("bartender")[0].confidence, 78);

    engine.startDialogue("dialogue-bartender-case2");
    const answers = engine.getAvailableAnswers();
    const reportAnswer = answers.find(answer => answer.text.includes("Томас рассказал"));
    assert.equal(reportAnswer?.isAvailable, true);

    engine.selectAnswer(2);
    assert.match(engine.currentNode.text, /Томас говорил со мной/i);
    assert.match(engine.currentNode.text, /не превращайте наш страх в инструмент/i);
    assert.equal(memory.getMemory("bartender").dialogueHistory.some(entry =>
        entry.type === "rumor_received" && entry.rumorId === "detective-threatened-thomas"
    ), true);
});

test("DialogueEngine does not show Joe's rumor reaction before Thomas reports the event", () => {
    const { engine, memory } = createDialogueHarness();
    engine.startDialogue("dialogue-bartender-case2");

    assert.equal(memory.hasRumor("bartender", "detective-threatened-thomas"), false);
    const answers = engine.getAvailableAnswers();
    assert.equal(answers.some(answer => answer.text.includes("Томас рассказал") && answer.isAvailable), false);
});

test("DialogueEngine detects Kane's alibi contradiction against witness testimony", () => {
    const { engine, memory, inventory, emitted } = createDialogueHarness();

    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    assert.equal(inventory.hasInsight("waiter_saw_poisoning"), false);
    assert.equal(engine.getAvailableAnswers()[0].isAvailable, true);
    engine.selectAnswer(0);
    assert.equal(inventory.hasInsight("waiter_saw_poisoning"), true);

    engine.startDialogue("dialogue-rival-full");

    const contradictions = emitted.filter(event => event.name === "npc:contradiction_detected");
    assert.equal(contradictions.length, 1);
    assert.equal(contradictions[0].payload.contradictions[0].topic, "kane-presence-during-poisoning");
    assert.equal(memory.getContradictions().length, 1);

    const answers = engine.getAvailableAnswers();
    assert.equal(answers[0].isAvailable, true);
    engine.selectAnswer(0);
    assert.equal(inventory.hasInsight("kane_alibi_broken"), true);
    assert.equal(memory.getMemory("business_rival").dialogueHistory.some(entry => entry.nodeId === "caught_in_lie"), true);
});

test("DialogueEngine presents a manually prepared contradiction to the selected NPC", () => {
    const { engine, memory, inventory, emitted } = createDialogueHarness();

    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.startDialogue("dialogue-rival-full");

    const prepared = memory.prepareConfrontation(
        "waiter-kane-at-poisoning",
        "kane-left-before-poisoning",
        "business_rival"
    );
    assert.equal(prepared.prepared, true);

    const result = engine.presentPreparedContradiction();
    assert.equal(result.success, true);
    assert.equal(result.reaction, true);
    assert.match(result.node.text, /сопоставили мои слова/i);
    assert.equal(inventory.hasInsight("kane_alibi_broken"), true);
    assert.equal(memory.hasConfronted("business_rival", "waiter-kane-at-poisoning", "kane-left-before-poisoning"), true);
    assert.equal(memory.getPreparedConfrontation("business_rival"), null);
    const availableAfterConfrontation = engine.getAvailableAnswers();
    assert.ok(availableAfterConfrontation.some(answer => answer.text.includes("Томас видел") && answer.isAvailable));
    assert.ok(availableAfterConfrontation.some(answer => answer.text.includes("Почему вы солгали") && answer.isAvailable));
    assert.equal(memory.hasExposedLie("business_rival", "kane-left-before-poisoning"), true);
    assert.equal(memory.getPressure("business_rival"), 25);
    assert.equal(emitted.some(event => event.name === "npc:contradiction_presented"), true);

    const repeated = engine.presentPreparedContradiction();
    assert.equal(repeated.success, false);
    assert.equal(repeated.reason, "no_prepared_confrontation");
});

test("Thomas withholds formal testimony when trust is low or pressure is high", () => {
    const { engine, inventory, memory } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(1);
    assert.equal(memory.getTrust("waiter"), 47);
    assert.equal(memory.getPressure("waiter"), 8);
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.selectAnswer(0);

    const answers = engine.getAvailableAnswers();
    assert.equal(answers.some(answer => answer.nextNode === "protection" && answer.isAvailable), false);
    assert.equal(answers.some(answer => answer.nextNode === "waiter_hesitates" && answer.isAvailable), true);
    engine.selectAnswer(1);
    assert.equal(inventory.hasInsight("waiter_saw_poisoning"), false);
    assert.equal(memory.getStatements().some(statement => statement.id === "waiter-kane-at-poisoning"), false);
});

test("DialogueEngine supports trust and pressure gates for psychological dialogue choices", () => {
    const { engine, memory } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");

    assert.equal(engine._checkCondition("trust_at_least:50"), true);
    assert.equal(engine._checkCondition("trust_below:50"), false);
    assert.equal(engine._checkCondition("pressure_below:1"), true);
    assert.equal(engine._checkCondition("pressure_at_least:1"), false);

    memory.recordAnswerSelected("waiter", "dialogue-waiter", "greeting", {
        text: "Я тебе угрожаю.", tone: "threatening"
    });
    assert.equal(engine._checkCondition("pressure_at_least:12"), true);
    assert.equal(engine._checkCondition("disposition:pressured"), false);
    assert.equal(engine._checkCondition("disposition:overwhelmed"), false);
    assert.equal(engine._checkCondition("lie_exposed:unknown-claim"), false);
});

test("DialogueEngine presents evidence, applies NPC reactions and prevents duplicate presentations", () => {
    const { engine, memory, emitted } = createDialogueHarness();
    const displayed = [];
    engine.onNodeChange = node => displayed.push(node);

    engine.startDialogue("dialogue-waiter");
    const result = engine.presentEvidence("bar_photo");

    assert.equal(result.success, true);
    assert.equal(result.reaction, true);
    assert.match(result.node.text, /это Кейн/i);
    assert.equal(engine.getAvailableAnswers().length, 2);
    assert.equal(memory.hasPresentedEvidence("waiter", "bar_photo"), true);
    assert.equal(engine.inventory.hasInsight("kane_identified_in_photo"), true);
    assert.equal(displayed.at(-1).id, "evidence_bar_photo");

    const duplicate = engine.presentEvidence("bar_photo");
    assert.equal(duplicate.success, false);
    assert.equal(duplicate.reason, "already_presented");
    assert.equal(emitted.filter(event => event.name === "npc:memory_changed").length > 0, true);
});

test("DialogueEngine refuses evidence not currently collected", () => {
    const { engine } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");

    const result = engine.presentEvidence("contract_folder");
    assert.equal(result.success, false);
    assert.equal(result.reason, "evidence_not_available");
});
