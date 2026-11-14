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
        getNPCById(id) { return ({
            waiter: {
                name: "Томас", availableForCall: false,
                psychology: {
                    cooperationResistance: 0.12,
                    cooperationThresholds: { withdrawn: 18, reluctant: 48, guarded: 58, willing: 78 }
                }
            },
            bartender: { name: "Джо", availableForCall: true },
            journalist: { name: "Лора", availableForCall: true },
            labour_inspector: { name: "Илья Руденко", availableForCall: false },
            tram_conductor: { name: "Павел Соколов", availableForCall: false },
            mill_watchman: { name: "Степан Орлов", availableForCall: false },
            diner_owner: { name: "Элеонора Брукс", availableForCall: false },
            telephone_operator: { name: "Марта Вейл", availableForCall: false },
            line_technician: { name: "Генри Кларк", availableForCall: false },
            ex_wife: { name: "Анна", availableForCall: true },
            woman_in_red: { name: "Ева", availableForCall: false }
        })[id] || null; },
        getObjectById(id) { return ({ bar_photo: { id, name: "Фотография из бара", icon: "📸", isEvidence: true }, poison_vial: { id, name: "Пузырёк с ядом", isEvidence: true }, tram_route_entry: { id, name: "Выписка из путевого листа трамвая №4", icon: "🎟️", isEvidence: true }, mill_shift_extract: { id, name: "Выписка из журнала ночной смены", icon: "📋", isEvidence: true }, diner_cash_slip: { id, name: "Кассовый чек закусочной", icon: "🧾", isEvidence: true }, public_telephone_booth: { id, name: "Уличная телефонная будка", icon: "☎️" }, telephone_exchange_slip: { id, name: "Карточка междугороднего запроса", icon: "📞", isEvidence: true }, booth_t17_maintenance_ticket: { id, name: "Наряд на ремонт будки Т-17", icon: "🛠️", isEvidence: true } })[id] || null; }
    });

    for (const path of [
        "assets/js/npc/npcMemoryService.js",
        "assets/js/npc/npcMotivationService.js",
        "assets/js/npc/npcSocialNetwork.js",
        "assets/js/systems/board.js",
        "assets/js/npc/dialogueEngine.js",
        "assets/data/cases/case-002/dialogues/waiter.js",
        "assets/data/cases/case-002/dialogues/bartender_case2.js",
        "assets/data/cases/case-002/dialogues/journalist.js",
        "assets/data/cases/case-002/dialogues/labour_inspector.js",
        "assets/data/cases/case-002/dialogues/tram_conductor.js",
        "assets/data/cases/case-002/dialogues/mill_watchman.js",
        "assets/data/cases/case-002/dialogues/diner_owner.js",
        "assets/data/cases/case-002/dialogues/telephone_operator.js",
        "assets/data/cases/case-002/dialogues/line_technician.js",
        "assets/data/cases/case-002/dialogues/anna.js",
        "assets/data/cases/case-002/dialogues/woman_in_red.js",
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
        const gameTime = {
            day: 1, hour: 18, minute: 0,
            advance(minutes) {
                this.minute += minutes;
                while (this.minute >= 60) { this.minute -= 60; this.hour++; }
                while (this.hour >= 24) { this.hour -= 24; this.day++; }
            }
        };
        const npcManager = {
            isNPCAvailable(id) {
                return { available: true, location: id === "journalist" ? "newspaper_office" : "bar_joe" };
            }
        };
        const motivationService = new NPCMotivationService(memory);
        const socialNetwork = new NPCSocialNetwork(null, memory, npcManager, gameTime);
        socialNetwork.setMotivationService(motivationService);
        socialNetwork.setCase({
            id: "case-002", npcs: ["waiter", "bartender", "journalist"],
            npcMotivations: {
                bartender: {
                    motives: [{ id: "protect_staff", weight: 85, pressureResistance: 0.55 }, { id: "keep_bar_open", weight: 65, pressureResistance: 0.20 }],
                    loyalties: [{ npcId: "waiter", strength: 86, protectThreshold: 62, appliesTo: ["detective_behavior"], motiveId: "protect_staff" }]
                }
            },
            socialNetwork: {
                maxHops: 2,
                edges: [
                    { from: "waiter", to: "bartender", relationship: "coworkers", trust: 80, channel: "in_person", delayMinutes: 15, minTrustToShare: 35, shareTypes: ["detective_behavior"], canForward: true },
                    { from: "bartender", to: "waiter", relationship: "coworkers", trust: 80, channel: "in_person", delayMinutes: 20, minTrustToShare: 35, shareTypes: ["detective_behavior"], canForward: false },
                    { from: "bartender", to: "journalist", relationship: "source", trust: 65, channel: "message", delayMinutes: 30, minTrustToShare: 50, shareTypes: ["detective_behavior"], canForward: true },
                    { from: "journalist", to: "bartender", relationship: "source", trust: 55, channel: "message", delayMinutes: 30, minTrustToShare: 50, shareTypes: ["detective_behavior"], canForward: false }
                ]
            }
        });
        const engine = new DialogueEngine(inventory, gameTime);
        engine.setMemoryService(memory);
        engine.setMotivationService(motivationService);
        engine.setSocialNetwork(socialNetwork);
        return { inventory, memory, engine, gameTime, socialNetwork, motivationService };
    })()`, context);

    return {
        ...setup, emitted, context,
        advance(minutes) {
            setup.gameTime.advance(minutes);
            return setup.socialNetwork.processDueDeliveries();
        }
    };
}

test("DialogueEngine supports hidden motive and dynamic loyalty conditions", () => {
    const { engine, memory, motivationService } = createDialogueHarness();
    engine.startDialogue("dialogue-bartender-case2");
    assert.equal(engine._checkCondition("motive:protect_staff"), true);
    assert.equal(engine._checkCondition("loyalty_at_least:waiter:60"), true);
    assert.equal(engine._checkCondition("loyalty_below:waiter:60"), false);
    for (let i = 0; i < 8; i++) memory.recordAnswerSelected("bartender", "pressure-dialogue", "pressure-" + i, { text: "Давление продолжается.", tone: "threatening" });
    assert.equal(motivationService.getEffectiveLoyalty("bartender", "waiter").protects, false);
    assert.equal(engine._checkCondition("loyalty_below:waiter:60"), true);
    assert.equal(engine._checkCondition("loyalty_at_least:waiter:60"), false);
    assert.equal(engine._checkCondition("motive:unknown_motive"), false);
});

test("Journalist acknowledges an off-screen deadline action only after her goal is completed", () => {
    const { engine } = createDialogueHarness();
    engine.setRelationshipService({
        getGoalProgress(npcId, goalId) {
            return npcId === "journalist" && goalId === "publish_exclusive" ? 1 : 0;
        },
        isGoalCompleted(npcId, goalId) {
            return npcId === "journalist" && goalId === "publish_exclusive";
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-journalist");
    const answer = engine.getAvailableAnswers().find(item =>
        item.condition === "npc_goal_completed:publish_exclusive"
    );
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, "deadline_followup");
    assert.match(engine.currentNode.text, /написала Джо сама/i);
});

test("Joe's second-case dialogue acknowledges personal goals achieved off-screen", () => {
    const { engine } = createDialogueHarness();
    engine.setRelationshipService({
        getGoalProgress(npcId, goalId) {
            return npcId === "bartender" && goalId === "maintain_bar_community" ? 2 : 0;
        },
        isGoalCompleted(npcId, goalId) {
            return npcId === "bartender" && goalId === "maintain_bar_community";
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-bartender-case2");
    const answer = engine.getAvailableAnswers().find(item =>
        item.condition === "npc_goal_completed:maintain_bar_community"
    );
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, "community_support");
    assert.match(engine.currentNode.text, /Лора напишет|Лора напишет|Элиас ещё в первом деле/i);
});

test("DialogueEngine remembers how Joe was treated in the previous investigation", () => {
    const { engine, memory } = createDialogueHarness();
    engine.startDialogue("dialogue-bartender-case2");
    assert.equal(engine.getAvailableAnswers().some(answer =>
        answer.condition === "prior_case_memory:player_threatened" && answer.isAvailable
    ), false);
    assert.equal(engine.getAvailableAnswers().some(answer =>
        answer.condition === "prior_case_memory:player_reassured" && answer.isAvailable
    ), false);

    engine.reset();
    memory.setCase("case-001");
    memory.recordDialogueStarted("bartender", "dialogue-bartender");
    memory.recordAnswerSelected("bartender", "dialogue-bartender", "greeting", {
        text: "Не заставляй меня повторять, Джо.",
        tone: "threatening",
        memoryImportance: 4,
        memoryTags: ["player_threatened"]
    });
    memory.setCase("case-002");

    engine.startDialogue("dialogue-bartender-case2");
    const remembered = engine.getAvailableAnswers().find(answer =>
        answer.condition === "prior_case_memory:player_threatened"
    );
    assert.equal(remembered?.isAvailable, true);
    assert.equal(engine.selectAnswer(remembered.index).id, "remembers_threat");
    assert.match(engine.currentNode.text, /не собираюсь снова проходить через это/i);
    assert.equal(engine._checkCondition("long_term_trust_below:49"), true);
    assert.equal(engine._checkCondition("long_term_trust_at_least:48.8"), true);
    assert.equal(engine._checkCondition("long_term_disposition:cautious"), true);
    assert.equal(engine._checkCondition("long_term_disposition:guarded"), false);
    engine.setRelationshipService({
        getGoalProgress(npcId, goalId) { return npcId === "bartender" && goalId === "maintain_bar_community" ? 1 : 0; },
        isGoalCompleted(npcId, goalId) { return npcId === "bartender" && goalId === "maintain_bar_community"; }
    });
    assert.equal(engine._checkCondition("npc_goal_progress_at_least:maintain_bar_community:1"), true);
    assert.equal(engine._checkCondition("npc_goal_completed:maintain_bar_community"), true);
    assert.equal(engine._checkCondition("npc_goal_completed:missing_goal"), false);
    assert.equal(engine._checkCondition("familiarity_at_least:2"), true);
});

test('Joe does not mistake a threat from the current case for an earlier investigation', () => {
    const { engine, memory, context } = createDialogueHarness();
    memory.recordAnswerSelected('bartender', 'dialogue-bartender-case2', 'current-threat', {
        text: 'Не спорьте со мной.', tone: 'threatening', memoryTags: ['player_threatened'], memoryImportance: 4
    });
    assert.equal(memory.hasLongTermMemoryTag('bartender', 'player_threatened'), true);
    assert.equal(memory.hasLongTermMemoryTagFromPriorCase('bartender', 'player_threatened'), false);
    engine.startDialogue('dialogue-bartender-case2');
    assert.equal(engine.getAvailableAnswers().some(answer =>
        answer.condition === 'prior_case_memory:player_threatened' && answer.isAvailable), false);
    const snapshot = JSON.parse(JSON.stringify(memory.toJSON()));
    context.savedMemory = snapshot;
    const restored = vm.runInContext("NPCMemoryService.fromJSON(savedMemory, 'case-002')", context);
    assert.equal(restored.hasLongTermMemoryTagFromPriorCase('bartender', 'player_threatened'), false);
    restored.setCase('case-001');
    assert.equal(restored.hasLongTermMemoryTagFromPriorCase('bartender', 'player_threatened'), true,
        'memory belongs to another case once switching cases');
});

test("DialogueEngine lets accumulated distrust change Joe's returning behavior", () => {
    const { engine, memory } = createDialogueHarness();
    memory.setCase("case-001");
    for (let i = 0; i < 9; i++) {
        memory.recordAnswerSelected("bartender", "dialogue-bartender", "threat-" + i, {
            text: "Я добьюсь своего.",
            tone: "threatening",
            memoryImportance: 3
        });
    }
    assert.equal(memory.getLongTermProfile("bartender").disposition, "guarded");
    memory.setCase("case-002");
    engine.startDialogue("dialogue-bartender-case2");
    const guarded = engine.getAvailableAnswers().find(answer =>
        answer.condition === "long_term_disposition:guarded"
    );
    assert.equal(guarded?.isAvailable, true);
    assert.equal(engine.selectAnswer(guarded.index).id, "guarded_history");
    assert.match(engine.currentNode.text, /должен заслужить ваше доверие|держали слово/i);
});

test("DialogueEngine gives Joe a warmer greeting when the detective earned his trust", () => {
    const { engine, memory } = createDialogueHarness();
    memory.setCase("case-001");
    memory.recordDialogueStarted("bartender", "dialogue-bartender");
    memory.recordAnswerSelected("bartender", "dialogue-bartender", "know_man", {
        text: "Спасибо, Джо. Ты очень помог.",
        tone: "reassuring",
        memoryImportance: 3,
        memoryTags: ["player_reassured"]
    });
    memory.setCase("case-002");

    engine.startDialogue("dialogue-bartender-case2");
    const remembered = engine.getAvailableAnswers().find(answer =>
        answer.condition === "prior_case_memory:player_reassured"
    );
    assert.equal(remembered?.isAvailable, true);
    assert.equal(engine.selectAnswer(remembered.index).id, "remembers_kindness");
    assert.match(engine.currentNode.text, /приятно видеть/i);
});

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
    assert.equal(promises[0].fulfillment.insightId, "thomas_family_protected");
    assert.equal(memory.getMemory("waiter").dialogueHistory.some(entry => entry.type === "promise_made"), true);
});

test("DialogueEngine lets Thomas's intimidation report reach Joe through a timed social link", () => {
    const { engine, memory, advance, socialNetwork } = createDialogueHarness();

    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(1);
    assert.equal(socialNetwork.getKnownEventLog(20).length, 0);

    assert.equal(memory.hasRumor("bartender", "detective-threatened-thomas"), false);
    assert.equal(memory.hasRumor("waiter", "detective-threatened-thomas"), false);
    advance(15);
    assert.equal(memory.hasRumor("bartender", "detective-threatened-thomas"), true);
    assert.equal(memory.getRumors("bartender")[0].status, "unverified");
    assert.equal(memory.getRumors("bartender")[0].sourceTrust, 80);
    assert.equal(memory.getRumors("bartender")[0].confidence, 78);

    engine.startDialogue("dialogue-bartender-case2");
    const answers = engine.getAvailableAnswers();
    const reportAnswer = answers.find(answer => answer.text.includes("Томас рассказал"));
    assert.equal(reportAnswer?.isAvailable, true);

    engine.selectAnswer(reportAnswer.index);
    assert.equal(socialNetwork.getKnownEventLog(20).length, 1);
    assert.equal(socialNetwork.getKnownEventLog(20)[0].type, "delivered");
    assert.equal(socialNetwork.getKnownEventLog(20)[0].fromNpcId, "waiter");
    assert.equal(socialNetwork.getKnownEventLog(20)[0].toNpcId, "bartender");
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

test("Journalist reveals a betrayal only after the rumor reaches her", () => {
    const { engine, memory, advance, socialNetwork } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(1);
    for (let i = 0; i < 8; i++) memory.recordAnswerSelected("bartender", "dialogue-bartender-case2", "pressure-" + i, { text: "Я больше не хочу молчать.", tone: "threatening" });
    advance(15);
    assert.equal(memory.hasRumor("journalist", "detective-threatened-thomas"), false);
    assert.equal(socialNetwork.getKnownEventLog(20).length, 0);
    advance(30);
    assert.equal(memory.hasRumor("journalist", "detective-threatened-thomas"), true);
    engine.startDialogue("dialogue-journalist");
    const disclosure = engine.getAvailableAnswers().find(answer => answer.text.includes("разговоре с Томасом"));
    assert.equal(disclosure?.isAvailable, true);
    engine.selectAnswer(disclosure.index);
    assert.equal(engine.currentNode.id, "joe_told_journalist");
    const known = socialNetwork.getKnownEventLog(20);
    assert.equal(known.some(item => item.type === "betrayal" && item.fromNpcId === "bartender" && item.toNpcId === "journalist"), true);
    assert.equal(known.some(item => item.type === "delivered" && item.fromNpcId === "bartender" && item.toNpcId === "journalist"), true);
    assert.equal(known.every(item => item.fromNpcId === "bartender" && item.toNpcId === "journalist"), true);
});

test("Thomas can be falsely accused, apologize later and leave a traceable social report", () => {
    const { engine, memory, advance } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");
    const accusation = engine.getAvailableAnswers().find(answer => answer.accusation?.id === "thomas-complicity");
    assert.equal(accusation?.isAvailable, true);
    engine.selectAnswer(accusation.index);
    assert.equal(memory.getAccusations("waiter")[0].status, "pending");
    assert.equal(memory.hasRumor("bartender", "detective-accused-thomas-of-complicity"), false);
    advance(15);
    assert.equal(memory.hasRumor("bartender", "detective-accused-thomas-of-complicity"), true);

    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    const apology = engine.getAvailableAnswers().find(answer => answer.resolveAccusation?.id === "thomas-complicity");
    assert.equal(apology?.isAvailable, true);
    engine.selectAnswer(apology.index);

    assert.equal(memory.getAccusations("waiter")[0].status, "false");
    assert.equal(memory.hasRumor("bartender", "detective-apologized-to-thomas"), false);
    advance(15);
    assert.equal(memory.hasRumor("bartender", "detective-apologized-to-thomas"), true);
    assert.equal(memory.getCaseSocialSummary("case-002").npcs.waiter.accusations.false, 1);
});

test("Thomas can revise a statement after reviewing new evidence without erasing the original", () => {
    const { engine, memory, inventory } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    assert.equal(engine.getAvailableAnswers()[0].isAvailable, true);
    engine.selectAnswer(0);

    assert.equal(engine.currentNode.id, "protection");
    assert.equal(memory.getStatementById("waiter-kane-at-poisoning").status, "active");
    const revision = engine.getAvailableAnswers().find(answer => answer.nextNode === "protection_revision");
    assert.equal(revision?.isAvailable, true);
    engine.selectAnswer(revision.index);

    assert.equal(engine.currentNode.id, "protection_revision");
    assert.equal(memory.getStatementById("waiter-kane-at-poisoning").status, "superseded");
    assert.equal(memory.getStatementById("waiter-kane-at-poisoning-v2").version, 2);
    assert.equal(memory.getClaimHistory("waiter", "waiter-kane-at-poisoning-v2").length, 2);
    assert.match(memory.getStatementById("waiter-kane-at-poisoning-v2").summary, /не видел сам момент/i);
    assert.equal(inventory.hasItem("bar_photo"), true);
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

test("DialogueEngine exposes cooperation and active-testimony conditions without exposing private history", () => {
    const { engine, memory } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");
    assert.equal(engine._checkCondition("cooperation_at_least:50"), true);
    assert.equal(engine._checkCondition("cooperation_state:guarded"), true);
    assert.equal(engine._checkCondition("has_claim:waiter-kane-at-poisoning"), false);
    assert.equal(engine._checkCondition("has_claim_topic:kane-presence-during-poisoning"), false);

    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning",
        topic: "kane-presence-during-poisoning",
        value: "present-at-bar-during-poisoning"
    });
    assert.equal(engine._checkCondition("has_claim:waiter-kane-at-poisoning"), true);
    assert.equal(engine._checkCondition("has_claim_topic:kane-presence-during-poisoning"), true);
    memory.adjustCooperation("waiter", -20, "test:withdrawal");
    assert.equal(engine._checkCondition("cooperation_below:40"), true);
    assert.equal(engine._checkCondition("cooperation_state:reluctant"), true);
});

test("Thomas can narrow an active statement after intimidation, without changing the underlying evidence", () => {
    const { engine, inventory, memory } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    engine.selectAnswer(0);
    const promise = engine.getAvailableAnswers().find(answer => answer.promise?.id === "thomas-family-protection");
    assert.equal(promise?.isAvailable, true);
    engine.selectAnswer(promise.index);

    assert.equal(memory.hasClaim("waiter", "waiter-kane-at-poisoning"), true);
    const threat = engine.getAvailableAnswers().find(answer =>
        answer.cooperationDelta === -25 && answer.nextNode === "end_waiter"
    );
    assert.equal(threat?.isAvailable, true);
    engine.selectAnswer(threat.index);
    assert.equal(memory.getCooperationState("waiter", {
        cooperationResistance: 0.12,
        cooperationThresholds: { withdrawn: 18, reluctant: 48, guarded: 58, willing: 78 }
    }).state, "reluctant");

    const insightCount = inventory.insights.length;
    engine.reset();
    engine.startDialogue("dialogue-waiter");
    const reconsider = engine.getAvailableAnswers().find(answer => answer.nextNode === "testimony_reconsiders");
    assert.equal(reconsider?.isAvailable, true);
    engine.selectAnswer(reconsider.index);

    const original = memory.getStatementById("waiter-kane-at-poisoning");
    const revised = memory.getStatementById("waiter-kane-at-poisoning-reconsidered");
    assert.equal(original.status, "superseded");
    assert.equal(revised.status, "active");
    assert.equal(revised.revisionOf, original.id);
    assert.match(revised.summary, /отказывается утверждать/i);
    assert.equal(memory.getClaimHistory("waiter", revised.id).length, 2);
    assert.equal(inventory.insights.length, insightCount);
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
    assert.equal(engine.getAvailableAnswers().length, 3);
    assert.equal(engine.getAvailableAnswers().some(answer => answer.accusation?.id === "thomas-complicity"), true);
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


test("DialogueEngine gates dialogue branches on each NPC's received rumor and independent verification", () => {
    const { engine, memory } = createDialogueHarness();
    engine.currentDialogue = { id: "rumor-condition-test", npcId: "waiter" };
    engine.currentNode = {
        id: "rumor_gate",
        answers: [
            { text: "Пока слух не подтверждён", nextNode: "unverified", condition: "rumor_status:joe-threatened-thomas:unverified", hiddenWhenUnavailable: true },
            { text: "Слух оспорен", nextNode: "disputed", condition: "rumor_status:joe-threatened-thomas:disputed", hiddenWhenUnavailable: true },
            { text: "Высокая уверенность", nextNode: "high_confidence", condition: "rumor_confidence_at_least:joe-threatened-thomas:70", hiddenWhenUnavailable: true }
        ]
    };

    const received = memory.receiveSocialRumor("waiter", {
        id: "joe-threatened-thomas",
        kind: "detective_behavior",
        text: "Детектив угрожал Томасу."
    }, {
        fromNpcId: "bartender",
        originalSourceNpcId: "bartender",
        sourceEvent: { dialogueId: "dialogue-joe", nodeId: "report", answerText: "Я расскажу, что произошло." },
        recipientTrust: 80,
        hops: 1,
        channel: "message"
    });
    assert.equal(received.received, true);
    assert.equal(engine._checkCondition("rumor_status:joe-threatened-thomas:unverified"), true);
    assert.equal(engine._checkCondition("rumor_confidence_at_least:joe-threatened-thomas:70"), true);
    assert.equal(engine.getAvailableAnswers().length, 2);

    memory.recordClaim("journalist", {
        id: "lora-refutes-joe-rumor",
        topic: "joe-threatened-thomas",
        value: "no-threat-observed",
        directObservation: true,
        refutesRumorIds: ["joe-threatened-thomas"]
    });
    const challenged = memory.challengeRumor("waiter", "joe-threatened-thomas", "journalist", "lora-refutes-joe-rumor");
    assert.equal(challenged.challenged, true);
    assert.equal(engine._checkCondition("rumor_status:joe-threatened-thomas:disputed"), true);
    assert.equal(engine._checkCondition("rumor_confidence_at_least:joe-threatened-thomas:70"), false);
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "disputed"), true);
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "unverified"), false);
    assert.equal(engine._checkCondition("rumor_status:unknown-rumor:disputed"), false);
});

test("Joe's follow-up is visible only after Joe personally completed his support action", () => {
    const { engine } = createDialogueHarness();
    const completed = new Set();
    engine.setRelationshipService({
        hasCompletedInteraction(npcId, ruleId) {
            return npcId === "bartender" && completed.has(ruleId);
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-bartender-case2");
    const id = "joe-reassures-thomas-after-threat";
    const condition = "npc_action_completed:" + id;
    assert.equal(engine.getAvailableAnswers().find(answer => answer.condition === condition)?.isAvailable, false);
    completed.add(id);
    assert.equal(engine._checkCondition(condition), true);
    const response = engine.getAvailableAnswers().find(answer => answer.condition === condition);
    assert.equal(response?.isAvailable, true);
    assert.equal(engine.selectAnswer(response.index).id, "joe_helped_thomas");
    assert.match(engine.currentNode.text, /поговорил с Томасом/i);
    assert.equal(engine._checkCondition("npc_action_completed:unknown-action"), false);
});

test("Lora does not describe an off-screen investigation before she actually acts", () => {
    const { engine } = createDialogueHarness();
    let checked = false;
    engine.setRelationshipService({
        hasCompletedInteraction(npcId, ruleId) {
            return checked && npcId === "journalist" && ruleId === "lora-questions-joe-about-threat";
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-journalist");
    const condition = "npc_action_completed:lora-questions-joe-about-threat";
    assert.equal(engine.getAvailableAnswers().find(answer => answer.condition === condition)?.isAvailable, false);
    checked = true;
    const answer = engine.getAvailableAnswers().find(item => item.condition === condition);
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, "lora_checked_threat");
    assert.match(engine.currentNode.text, /независимое подтверждение/i);
});

test("Lora reports an inconclusive witness check without treating repeated gossip as proof", () => {
    const { engine } = createDialogueHarness();
    engine.setRelationshipService({
        getInvestigationOutcome(npcId, ruleId) {
            return npcId === "journalist" && ruleId === "lora-questions-joe-about-threat"
                ? "no_independent_evidence" : null;
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-journalist");
    const condition = "npc_investigation_outcome:lora-questions-joe-about-threat:no_independent_evidence";
    assert.equal(engine._checkCondition(condition), true);
    assert.equal(engine._checkCondition("npc_investigation_outcome:lora-questions-joe-about-threat:corroborated"), false);
    const answer = engine.getAvailableAnswers().find(item => item.condition === condition);
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, "lora_no_confirmation");
    assert.match(engine.currentNode.text, /не второе независимое свидетельство/i);
});

test("Lora's second interview remains hidden until her follow-up is completed", () => {
    const { engine } = createDialogueHarness();
    let completed = false;
    engine.setRelationshipService({
        getInvestigationOutcome(npcId, ruleId) {
            return completed && npcId === "journalist" &&
                ruleId === "lora-interviews-eva-about-threat"
                ? "no_independent_evidence" : null;
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-journalist");
    const condition = "npc_investigation_outcome:lora-interviews-eva-about-threat:no_independent_evidence";
    assert.equal(engine.getAvailableAnswers().find(item => item.condition === condition)?.isAvailable, false);
    completed = true;
    const answer = engine.getAvailableAnswers().find(item => item.condition === condition);
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, "lora_eva_followup_unverified");
    assert.match(engine.currentNode.text, /связалась с Евой/i);
});

test("Anna only discusses Eva's protective follow-up after she actually received the call", () => {
    const { engine } = createDialogueHarness();
    let received = false;
    engine.setRelationshipService({
        hasReceivedInteraction(npcId, ruleId) {
            return received && npcId === "ex_wife" && ruleId === "eva-protects-anna-after-pressure";
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-ex-wife");
    const condition = "npc_action_received:eva-protects-anna-after-pressure";
    assert.equal(engine.getAvailableAnswers().find(item => item.condition === condition)?.isAvailable, false);
    received = true;
    const answer = engine.getAvailableAnswers().find(item => item.condition === condition);
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, "eva_supported_anna");
    assert.match(engine.currentNode.text, /Ева позвонила мне снова/);
    assert.equal(engine._checkCondition("npc_action_received:unknown"), false);
});

test("Eva can describe her own protective action only after it happened", () => {
    const { engine } = createDialogueHarness();
    engine.setRelationshipService({
        hasCompletedInteraction(npcId, ruleId) {
            return npcId === "woman_in_red" && ruleId === "eva-protects-anna-after-pressure";
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-woman-in-red");
    const condition = "npc_action_completed:eva-protects-anna-after-pressure";
    const answer = engine.getAvailableAnswers().find(item => item.condition === condition);
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, "eva_protected_anna");
    assert.match(engine.currentNode.text, /позвонила ей снова/i);
});

test("Kane cannot confess through a casual conversation without corroborating clues", () => {
    const { engine, inventory } = createDialogueHarness();
    engine.startDialogue("dialogue-rival-full");
    const whyAnswer = engine.getAvailableAnswers().find(item => item.nextNode === "why");
    assert.equal(whyAnswer?.isAvailable, true);
    engine.selectAnswer(whyAnswer.index);
    assert.equal(engine.currentNode.id, "why");

    const confession = engine.getAvailableAnswers().find(item => item.nextNode === "confession");
    assert.equal(confession?.isAvailable, false);
    assert.equal(engine.selectAnswer(confession.index).error, "Условие не выполнено");
    assert.equal(inventory.hasInsight("full_confession_kane"), false);
    const pause = engine.getAvailableAnswers().find(item => item.nextNode === "interview_paused");
    assert.equal(pause?.isAvailable, true);
    assert.equal(engine.selectAnswer(pause.index).id, "interview_paused");

    inventory.insights.push("waiter_saw_poisoning", "kane_stole_vial");
    engine.startDialogue("dialogue-rival-full");
    engine.selectAnswer(engine.getAvailableAnswers().find(item => item.nextNode === "why").index);
    const withEvidence = engine.getAvailableAnswers().find(item => item.nextNode === "confession");
    assert.equal(withEvidence?.isAvailable, true);
    assert.equal(engine.selectAnswer(withEvidence.index).id, "confession");
});

test("Kane's vial confrontation leads to evidence assessment, not an instant detailed confession", () => {
    const { engine, inventory } = createDialogueHarness();
    inventory.insights.push("waiter_saw_poisoning", "kane_stole_vial");
    engine.startDialogue("dialogue-rival-full");
    engine.selectAnswer(engine.getAvailableAnswers().find(item => item.nextNode === "caught_in_lie").index);
    const vial = engine.getAvailableAnswers().find(item =>
        item.text.startsWith("Тогда объясните, что вы сделали с пузырьком.")
    );
    assert.equal(vial?.isAvailable, true);
    assert.equal(engine.selectAnswer(vial.index).id, "why");
});

test("Kane's procedural objection is discussed only after his autonomous response", () => {
    const { engine } = createDialogueHarness();
    let filed = false;
    engine.setRelationshipService({
        hasCompletedInteraction(npcId, ruleId) {
            return filed && npcId === "business_rival" && ruleId === "kane-files-objection";
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-rival-full");
    const condition = "npc_action_completed:kane-files-objection";
    assert.equal(engine.getAvailableAnswers().find(item => item.condition === condition)?.isAvailable, false);
    filed = true;
    const answer = engine.getAvailableAnswers().find(item => item.condition === condition);
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, "kane_formal_objection");
    assert.match(engine.currentNode.text, /возражения в протокол/i);
});

test('Joe hears Lora’s cautious conclusion only after her independent follow-up message', () => {
    const { engine } = createDialogueHarness();
    let received = false;
    engine.setRelationshipService({
        hasReceivedInteraction(npcId, ruleId) {
            return received && npcId === 'bartender' && ruleId === 'lora-updates-joe-after-thomas-check';
        },
        toJSON() { return {}; }
    });
    engine.startDialogue('dialogue-bartender-case2');
    const condition = 'npc_action_received:lora-updates-joe-after-thomas-check';
    assert.equal(engine.getAvailableAnswers().some(answer => answer.condition === condition), false);
    received = true;
    const answer = engine.getAvailableAnswers().find(item => item.condition === condition);
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, 'joe_lora_thomas_check_update');
    assert.match(engine.currentNode.text, /независимого подтверждения обвинению пока нет/);
    assert.doesNotMatch(engine.currentNode.text, /доказано|установлено, что.*лож/i);
});

test('Thomas mentions Joe’s delayed support only after receiving it, and not on every visit', () => {
    const { engine } = createDialogueHarness();
    let supported = false;
    engine.setRelationshipService({
        hasReceivedInteraction(npcId, id) {
            return supported && npcId === 'waiter' && id === 'joe-reassures-thomas-after-lora-update';
        },
        toJSON() { return {}; }
    });
    engine.startDialogue('dialogue-waiter');
    assert.notEqual(engine.currentNode.id, 'joe_after_lora_support_opening');
    engine.reset();
    supported = true;
    engine.startDialogue('dialogue-waiter');
    assert.equal(engine.currentNode.id, 'joe_after_lora_support_opening');
    assert.match(engine.currentNode.text, /не нашла независимых доказательств/);
    engine.reset();
    engine.startDialogue('dialogue-waiter');
    assert.notEqual(engine.currentNode.id, 'joe_after_lora_support_opening');
});

test('Kane answers an explicitly prepared route question without confessing or adding an insight', () => {
    const { engine, inventory } = createDialogueHarness();
    let prepared = false;
    let discussed = false;
    engine.setInvestigationBoard({ hasPreparedRouteQuestion(npcId) {
        return prepared && !discussed && npcId === 'business_rival';
    }, markRouteQuestionDiscussed(npcId) {
        if (npcId !== 'business_rival' || !prepared || discussed) return false;
        discussed = true;
        return true;
    } });
    engine.startDialogue('dialogue-rival-full');
    const condition = 'route_question_prepared';
    assert.equal(engine.getAvailableAnswers().find(a => a.condition === condition)?.isAvailable, false);
    prepared = true;
    const answer = engine.getAvailableAnswers().find(a => a.condition === condition);
    assert.equal(answer?.isAvailable, true);
    assert.equal(engine.selectAnswer(answer.index).id, 'route_question_response');
    assert.equal(discussed, true);
    assert.match(engine.currentNode.text, /не мой маршрут/);
    assert.equal(inventory.insights.length, 0);
    engine.startDialogue('dialogue-rival-full');
    assert.equal(engine.getAvailableAnswers().find(a => a.condition === condition)?.isAvailable, false);
});

test('Thomas answers the telephone record follow-up only after the document is found, once per case', () => {
    const { engine, memory, inventory, context } = createDialogueHarness();
    memory.recordClaim('waiter', { id: 'waiter-kane-at-poisoning', topic: 'kane-presence-during-poisoning',
        value: 'saw-poisoning', summary: 'Томас видел Кейна у стола' });
    assert.equal(engine.startDialogue('dialogue-waiter'), true);
    assert.equal(engine.currentNode.id, 'testimony_given_opening');
    assert.equal(engine.getAvailableAnswers().some(a => a.nextNode === 'telephone_record_scope'), false);
    inventory.items.push('telephone_exchange_slip');
    assert.equal(engine.startDialogue('dialogue-waiter'), true);
    const followup = engine.getAvailableAnswers().find(a => a.nextNode === 'telephone_record_scope');
    assert.equal(followup?.isAvailable, true);
    assert.equal(engine.selectAnswer(followup.index).id, 'telephone_record_scope');
    assert.match(engine.currentNode.text, /не знаю, кто сделал запрос/);
    assert.equal(inventory.hasInsight('full_confession_kane'), false);
    assert.equal(memory.hasVisitedNode('waiter', 'dialogue-waiter', 'telephone_record_scope'), true);
    context.savedMemory = memory.toJSON();
    const loaded = vm.runInContext("NPCMemoryService.fromJSON(savedMemory, 'case-002')", context);
    for (let i = 0; i < 110; i++) loaded.recordNodeVisited('waiter', 'dialogue-waiter', { id: 'follow-up-' + i });
    assert.equal(loaded.hasVisitedNode('waiter', 'dialogue-waiter', 'telephone_record_scope'), true,
        'asked status must outlive the bounded recent dialogue history');
    engine.setMemoryService(loaded);
    assert.equal(engine.startDialogue('dialogue-waiter'), true);
    assert.equal(engine.getAvailableAnswers().some(a => a.nextNode === 'telephone_record_scope'), false);
    loaded.setCase('case-001');
    assert.equal(loaded.hasVisitedNode('waiter', 'dialogue-waiter', 'telephone_record_scope'), false);
});

test('Thomas telephone lead follows a real dialogue and remains checked after restoring memory and board', () => {
    const { engine, memory, inventory, context } = createDialogueHarness();
    const board = vm.runInContext('new InvestigationBoard()', context);
    board.setCase('case-002');
    engine.setInvestigationBoard(board);
    const checklist = (activeMemory, activeBoard) => activeBoard.getInvestigationChecklist({
        evidenceIds: inventory.items,
        statements: activeMemory.getStatements(),
        thomasTelephoneQuestionAsked: activeMemory.hasVisitedNode('waiter', 'dialogue-waiter', 'telephone_record_scope')
    });

    assert.equal(checklist(memory, board).nextActions.length, 0);
    memory.recordClaim('waiter', { id: 'waiter-kane-at-poisoning', topic: 'kane-presence-during-poisoning',
        value: 'saw-poisoning', summary: 'Томас видел Кейна у стола' });
    assert.equal(checklist(memory, board).nextActions.length, 0, 'a witness alone must not expose the document');
    inventory.items.push('telephone_exchange_slip');
    assert.equal(checklist(memory, board).nextActions[0].status, 'available');

    assert.equal(engine.startDialogue('dialogue-waiter'), true);
    const question = engine.getAvailableAnswers().find(answer => answer.nextNode === 'telephone_record_scope');
    assert.equal(question?.isAvailable, true);
    assert.equal(engine.selectAnswer(question.index).id, 'telephone_record_scope');
    assert.equal(checklist(memory, board).nextActions[0].status, 'checked');

    context.savedMemory = JSON.parse(JSON.stringify(memory.toJSON()));
    context.savedBoard = JSON.parse(JSON.stringify(board.toJSON()));
    const reloadedMemory = vm.runInContext("NPCMemoryService.fromJSON(savedMemory, 'case-002')", context);
    const reloadedBoard = vm.runInContext('InvestigationBoard.fromJSON(savedBoard)', context);
    assert.equal(checklist(reloadedMemory, reloadedBoard).nextActions[0].status, 'checked');
    engine.setMemoryService(reloadedMemory);
    assert.equal(engine.startDialogue('dialogue-waiter'), true);
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === 'telephone_record_scope'), false);
    reloadedBoard.setCase('case-001');
    reloadedMemory.setCase('case-001');
    assert.equal(checklist(reloadedMemory, reloadedBoard).nextActions.length, 0);
});

test('verified family safety partly repairs trust after a false accusation, only once and across saves', () => {
    const { engine, memory, inventory, context } = createDialogueHarness();
    memory.recordAccusation('waiter', { id: 'thomas-lied-about-poisoning', text: 'Томас солгал.' });
    memory.resolveAccusation('waiter', 'thomas-lied-about-poisoning', 'false', 'Отозвано после проверки.');
    engine.startDialogue('dialogue-waiter');
    const node = engine.currentDialogue.tree.nodes.family_safety_confirmed;
    const before = memory.getMemory('waiter').trust;
    const beforeCooperation = memory.getMemory('waiter').cooperation;
    engine._processNodeEffects({ ...node, givesInsight: null });
    assert.equal(memory.getMemory('waiter').trust, before, 'no restitution before verified safety');
    inventory.addInsight('thomas_family_protected');
    engine._processNodeEffects(node);
    assert.equal(memory.getMemory('waiter').trust, before + 4);
    assert.equal(memory.getMemory('waiter').cooperation, beforeCooperation + 5);
    assert.equal(memory.getAccusationStatus('waiter', 'thomas-lied-about-poisoning'), 'false');
    engine._processNodeEffects(node);
    assert.equal(memory.getMemory('waiter').trust, before + 4, 'repeat must never farm trust');

    context.savedMemory = JSON.parse(JSON.stringify(memory.toJSON()));
    const restored = vm.runInContext("NPCMemoryService.fromJSON(savedMemory, 'case-002')", context);
    engine.setMemoryService(restored);
    engine._processNodeEffects(node);
    assert.equal(restored.getMemory('waiter').trust, before + 4);
    assert.equal(restored.getAccusationStatus('waiter', 'thomas-lied-about-poisoning'), 'false');
});

test('Joe partially rebuilds trust only after verified help following prior-case threats', () => {
    const { engine, memory, inventory, context } = createDialogueHarness();
    const verifiedNode = () => engine.currentDialogue.tree.nodes.joe_after_protection_verified_opening;
    engine.startDialogue('dialogue-bartender-case2');
    const untouched = memory.getMemory('bartender').trust;
    inventory.addInsight('thomas_family_protected');
    engine._processNodeEffects(verifiedNode());
    assert.equal(memory.getMemory('bartender').trust, untouched,
        'help alone cannot erase a past harm that did not occur');

    memory.setCase('case-001');
    memory.recordAnswerSelected('bartender', 'dialogue-bartender', 'threat', {
        text: 'Я заставлю вас говорить.', tone: 'threatening', memoryTags: ['player_threatened']
    });
    memory.setCase('case-002');
    const before = memory.getMemory('bartender').trust;
    engine._processNodeEffects(verifiedNode());
    assert.equal(memory.getMemory('bartender').trust, before + 4);
    engine._processNodeEffects(verifiedNode());
    assert.equal(memory.getMemory('bartender').trust, before + 4);
    assert.equal(memory.hasLongTermMemoryTag('bartender', 'player_threatened'), true);

    context.savedMemory = JSON.parse(JSON.stringify(memory.toJSON()));
    const restored = vm.runInContext("NPCMemoryService.fromJSON(savedMemory, 'case-002')", context);
    engine.setMemoryService(restored);
    engine._processNodeEffects(verifiedNode());
    assert.equal(restored.getMemory('bartender').trust, before + 4);
});

test("Kane revises only his alibi when confronted with Thomas, keeping a full confession gated", () => {
    const { engine, inventory, memory, context } = createDialogueHarness();
    inventory.insights.push("waiter_saw_poisoning");
    engine.startDialogue("dialogue-rival-full");
    engine.selectAnswer(engine.getAvailableAnswers().find(item => item.nextNode === "why").index);
    assert.equal(engine.getAvailableAnswers().find(item => item.nextNode === "confession")?.isAvailable, false);

    const partial = engine.getAvailableAnswers().find(item => item.nextNode === "partial_return");
    assert.equal(partial?.isAvailable, true);
    assert.equal(engine.selectAnswer(partial.index).id, "partial_return");
    const statements = memory.getMemory("business_rival").claims;
    const original = statements.find(item => item.id === "kane-left-before-poisoning");
    const revision = statements.find(item => item.id === "kane-admits-return-to-bar");
    assert.equal(original.status, "superseded");
    assert.equal(original.supersededBy, revision.id);
    assert.equal(revision.revisionOf, original.id);
    assert.equal(revision.version, 2);
    assert.equal(memory.hasClaim("business_rival", original.id), false);
    assert.equal(memory.hasClaim("business_rival", revision.id), true);
    assert.equal(inventory.hasInsight("full_confession_kane"), false);

    context.savedMemory = memory.toJSON();
    const loaded = vm.runInContext("NPCMemoryService.fromJSON(savedMemory, 'case-002')", context);
    assert.equal(loaded.hasClaim("business_rival", revision.id), true);
    assert.equal(loaded.getMemory("business_rival").claims.find(item => item.id === original.id).status, "superseded");
});

test("Kane's partial alibi admission stays hidden without Thomas's testimony", () => {
    const { engine, inventory } = createDialogueHarness();
    engine.startDialogue("dialogue-rival-full");
    engine.selectAnswer(engine.getAvailableAnswers().find(item => item.nextNode === "why").index);
    assert.equal(engine.getAvailableAnswers().find(item => item.nextNode === "partial_return")?.isAvailable, false);
    assert.equal(inventory.hasInsight("full_confession_kane"), false);
});

test("Kane's opening follows the latest testimony instead of repeating a superseded alibi", () => {
    const { engine, inventory, memory, context } = createDialogueHarness();
    assert.equal(engine.startDialogue("dialogue-rival-full"), true);
    assert.equal(engine.currentNode.id, "confrontation");

    inventory.insights.push("waiter_saw_poisoning");
    engine.selectAnswer(engine.getAvailableAnswers().find(item => item.nextNode === "why").index);
    engine.selectAnswer(engine.getAvailableAnswers().find(item => item.nextNode === "partial_return").index);

    const versionCount = memory.getMemory("business_rival").claims.length;
    assert.equal(engine.startDialogue("dialogue-rival-full"), true);
    assert.equal(engine.currentNode.id, "revised_opening");
    assert.match(engine.currentNode.text, /исправил своё алиби/);
    assert.equal(memory.getMemory("business_rival").claims.length, versionCount);
    assert.equal(memory.getMemory("business_rival").claims.find(item => item.id === "kane-left-before-poisoning").status, "superseded");

    context.savedMemory = memory.toJSON();
    const loaded = vm.runInContext("NPCMemoryService.fromJSON(savedMemory, 'case-002')", context);
    engine.setMemoryService(loaded);
    assert.equal(engine.startDialogue("dialogue-rival-full"), true);
    assert.equal(engine.currentNode.id, "revised_opening");

    inventory.insights.push("full_confession_kane");
    assert.equal(engine.startDialogue("dialogue-rival-full"), true);
    assert.equal(engine.currentNode.id, "post_confession_opening");
    assert.match(engine.currentNode.text, /подписал признание/);
    assert.equal(engine.selectAnswer(0).id, "post_confession_end");
});

test("dialogues without entry rules retain their original opening", () => {
    const { engine } = createDialogueHarness();
    assert.equal(engine.startDialogue("dialogue-journalist"), true);
    assert.equal(engine.currentNode.id, "greeting");
});

test("a revised Thomas statement invalidates Kane's old confession shortcut until independent documents are obtained", () => {
    const { engine, memory, inventory } = createDialogueHarness();
    inventory.insights.push("waiter_saw_poisoning", "kane_stole_vial");
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning",
        value: "saw-poisoning", summary: "Первоначальное показание"
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning-v2", topic: "kane-presence-during-poisoning",
        value: "saw-near-table", revisesClaimId: "waiter-kane-at-poisoning",
        summary: "Уточнил, что не видел момент попадания порошка"
    });
    engine.startDialogue("dialogue-rival-full");
    engine.selectAnswer(engine.getAvailableAnswers().find(item => item.nextNode === "why").index);
    assert.equal(engine._checkCondition("case_has_claim:waiter:waiter-kane-at-poisoning-v2"), true);
    assert.equal(engine._checkCondition("not:case_has_claim:waiter:waiter-kane-at-poisoning-v2"), false);
    const oldConfession = engine.getAvailableAnswers().find(item =>
        item.text.startsWith("У меня есть показания о порошке")
    );
    assert.equal(oldConfession?.isAvailable, false);
    assert.equal(engine.getAvailableAnswers().some(item =>
        item.nextNode === "confession" && item.isAvailable
    ), false);

    inventory.insights.push("hard_evidence_kane");
    const independentRoute = engine.getAvailableAnswers().find(item =>
        item.text.startsWith("У меня есть фотография")
    );
    assert.equal(independentRoute?.isAvailable, true);
    assert.equal(engine.selectAnswer(independentRoute.index).id, "confession");
});

test("Thomas's intimidation revision also prevents Kane's stale eyewitness confession route", () => {
    const { engine, memory, inventory } = createDialogueHarness();
    inventory.insights.push("waiter_saw_poisoning", "kane_stole_vial");
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning",
        value: "saw-poisoning", summary: "Первоначальное показание"
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning-reconsidered", topic: "kane-presence-during-poisoning",
        value: "saw-near-table", revisesClaimId: "waiter-kane-at-poisoning",
        summary: "После давления не утверждает, что видел отравление"
    });
    engine.startDialogue("dialogue-rival-full");
    engine.selectAnswer(engine.getAvailableAnswers().find(item => item.nextNode === "why").index);
    const oldRoute = engine.getAvailableAnswers().find(item =>
        item.text.startsWith("У меня есть показания о порошке")
    );
    assert.equal(oldRoute?.isAvailable, false);
    assert.equal(engine.getAvailableAnswers().some(item =>
        item.nextNode === "confession" && item.isAvailable
    ), false);
    inventory.insights.push("hard_evidence_kane");
    assert.equal(engine.getAvailableAnswers().find(item =>
        item.text.startsWith("У меня есть фотография")
    )?.isAvailable, true);
});

test("Thomas's repeat opening reflects corrected statements and later support", () => {
    const { engine, memory } = createDialogueHarness();
    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.currentNode.id, "greeting");

    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning",
        value: "saw-poisoning"
    });
    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.currentNode.id, "testimony_given_opening");

    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning-v2", topic: "kane-presence-during-poisoning",
        value: "saw-near-table", revisesClaimId: "waiter-kane-at-poisoning"
    });
    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.currentNode.id, "revised_testimony_opening");
    assert.match(engine.currentNode.text, /не видел, как порошок попал/i);
});

test("Anna and Lora use their own completed experiences as repeat openings", () => {
    const { engine } = createDialogueHarness();
    engine.setRelationshipService({
        hasReceivedInteraction(npcId, ruleId) {
            return npcId === "ex_wife" && ruleId === "eva-protects-anna-after-pressure";
        },
        getInvestigationOutcome(npcId, ruleId) {
            return npcId === "journalist" && ruleId === "lora-interviews-eva-about-threat"
                ? "no_independent_evidence" : null;
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-ex-wife");
    assert.equal(engine.currentNode.id, "supported_anna_opening");
    engine.startDialogue("dialogue-journalist");
    assert.equal(engine.currentNode.id, "lora_second_check_opening");
});

test("Thomas explains an honest photo correction without being labeled a liar", () => {
    const { engine, memory } = createDialogueHarness();
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning", value: "saw-poisoning"
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning-v2", topic: "kane-presence-during-poisoning",
        value: "near-victim-table-before-collapse", revisesClaimId: "waiter-kane-at-poisoning"
    });
    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.currentNode.id, "revised_testimony_opening");
    const reason = engine.getAvailableAnswers().find(item => item.nextNode === "revision_photo_reason");
    assert.equal(reason?.isAvailable, true);
    engine.selectAnswer(reason.index);
    assert.match(engine.currentNode.text, /фотографии/);
    assert.equal(memory.getAccusations("waiter").length, 0);
    assert.equal(memory.hasClaim("waiter", "waiter-kane-at-poisoning-v2"), true);
});

test("unfounded accusation after Thomas corrects testimony harms cooperation and creates a social report", () => {
    const { engine, memory, advance } = createDialogueHarness();
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning", value: "saw-poisoning"
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning-v2", topic: "kane-presence-during-poisoning",
        value: "near-victim-table-before-collapse", revisesClaimId: "waiter-kane-at-poisoning"
    });
    engine.startDialogue("dialogue-waiter");
    const before = memory.getMemory("waiter").cooperation;
    const accusation = engine.getAvailableAnswers().find(item => item.accusation?.id === "thomas-lied-about-poisoning");
    assert.equal(accusation?.isAvailable, true);
    engine.selectAnswer(accusation.index);
    assert.equal(engine.currentNode.id, "unfounded_lie_accusation");
    assert.ok(memory.getMemory("waiter").cooperation < before);
    assert.equal(memory.getAccusations("waiter").some(item => item.id === "thomas-lied-about-poisoning"), true);
    advance(15);
    assert.equal(memory.hasRumor("bartender", "detective-accused-thomas-after-correction"), true);
    engine.selectAnswer(0);
    assert.equal(engine.currentNode.id, "end_waiter_guarded");
    assert.doesNotMatch(engine.currentNode.text, /больше не буду молчать/);
});

test('Lora challenges an accusation only after its report reaches her and treats it as hearsay', () => {
    const { engine, memory, advance } = createDialogueHarness();
    engine.startDialogue('dialogue-journalist');
    assert.equal(engine.getAvailableAnswers().some(item =>
        item.nextNode === 'lora_heard_unfounded_accusation' && item.isAvailable), false);

    memory.recordClaim('waiter', { id: 'waiter-kane-at-poisoning', topic: 'kane-presence-during-poisoning',
        value: 'saw-poisoning' });
    memory.recordClaim('waiter', { id: 'waiter-kane-at-poisoning-v2', topic: 'kane-presence-during-poisoning',
        value: 'near-victim-table-before-collapse', revisesClaimId: 'waiter-kane-at-poisoning' });
    engine.startDialogue('dialogue-waiter');
    const accusation = engine.getAvailableAnswers().find(item =>
        item.accusation?.id === 'thomas-lied-about-poisoning');
    engine.selectAnswer(accusation.index);
    assert.equal(memory.hasRumor('journalist', 'detective-accused-thomas-after-correction'), false);
    for (let i = 0; i < 8; i++) memory.recordAnswerSelected('bartender', 'dialogue-bartender-case2',
        'pressure-report-' + i, { text: 'Я буду давить на вас.', tone: 'threatening' });
    advance(15);
    assert.equal(memory.hasRumor('bartender', 'detective-accused-thomas-after-correction'), true);
    engine.startDialogue('dialogue-journalist');
    assert.equal(engine.getAvailableAnswers().some(item =>
        item.nextNode === 'lora_heard_unfounded_accusation' && item.isAvailable), false);
    advance(30);
    assert.equal(memory.hasRumor('journalist', 'detective-accused-thomas-after-correction'), true);
    engine.startDialogue('dialogue-journalist');
    const question = engine.getAvailableAnswers().find(item =>
        item.nextNode === 'lora_heard_unfounded_accusation');
    assert.equal(question?.isAvailable, true);
    engine.selectAnswer(question.index);
    assert.match(engine.currentNode.text, /не присутствовала/);
    assert.match(engine.currentNode.text, /не могу подтвердить/);
});

test('Lora reports an independent interview without upgrading it to corroborated evidence', () => {
    const { engine } = createDialogueHarness();
    engine.startDialogue('dialogue-journalist');
    assert.equal(engine.getAvailableAnswers().some(answer =>
        answer.nextNode === 'lora_checked_accusation' && answer.isAvailable), false);
    engine.setRelationshipService({
        getInvestigationOutcome(npcId, ruleId) {
            return npcId === 'journalist' && ruleId === 'lora-checks-thomas-accusation'
                ? 'no_independent_evidence' : null;
        }, toJSON() { return {}; }
    });
    engine.startDialogue('dialogue-journalist');
    const check = engine.getAvailableAnswers().find(answer => answer.nextNode === 'lora_checked_accusation');
    assert.equal(check?.isAvailable, true);
    engine.selectAnswer(check.index);
    assert.match(engine.currentNode.text, /не делает меня очевидцем/);
    assert.match(engine.currentNode.text, /без независимого подтверждения/);
});

test("Thomas names detective pressure as the cause of his later retraction", () => {
    const { engine, memory } = createDialogueHarness();
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning", value: "saw-poisoning"
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning-reconsidered", topic: "kane-presence-during-poisoning",
        value: "near-victim-table-before-collapse", revisesClaimId: "waiter-kane-at-poisoning"
    });
    engine.startDialogue("dialogue-waiter");
    const ask = engine.getAvailableAnswers().find(item => item.nextNode === "revision_under_pressure_reason");
    assert.equal(ask?.isAvailable, true);
    engine.selectAnswer(ask.index);
    assert.match(engine.currentNode.text, /пригрозили/);
    assert.equal(memory.getAccusations("waiter").length, 0);
});

test("Thomas accepts a retraction without instantly forgiving an unsupported lie accusation", () => {
    const { engine, memory, advance } = createDialogueHarness();
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning", value: "saw-poisoning"
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning-v2", topic: "kane-presence-during-poisoning",
        value: "near-victim-table-before-collapse", revisesClaimId: "waiter-kane-at-poisoning"
    });
    engine.startDialogue("dialogue-waiter");
    const accusation = engine.getAvailableAnswers().find(a => a.accusation?.id === "thomas-lied-about-poisoning");
    engine.selectAnswer(accusation.index);
    const afterAccusation = memory.getMemory("waiter").cooperation;
    assert.equal(memory.getAccusationStatus("waiter", "thomas-lied-about-poisoning"), "pending");

    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.currentNode.id, "accused_after_revision_opening");
    const apology = engine.getAvailableAnswers().find(a => a.resolveAccusation?.id === "thomas-lied-about-poisoning");
    assert.equal(apology?.isAvailable, true);
    engine.selectAnswer(apology.index);
    assert.equal(engine.currentNode.id, "apology_not_forgiven");
    assert.equal(memory.getAccusationStatus("waiter", "thomas-lied-about-poisoning"), "false");
    assert.ok(memory.getMemory("waiter").cooperation < afterAccusation,
        "admitting a false accusation must not instantly erase its damage");
    assert.equal(memory.hasClaim("waiter", "waiter-kane-at-poisoning-v2"), true);
    advance(15);
    assert.equal(memory.hasRumor("bartender", "detective-retracted-thomas-lie-accusation"), true);

    const snapshot = memory.toJSON();
    assert.equal(snapshot.cases["case-002"].waiter.accusations.find(a =>
        a.id === "thomas-lied-about-poisoning").status, "false");
    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.currentNode.id, "apology_acknowledged_opening");
    assert.equal(engine.getAvailableAnswers().some(a => a.resolveAccusation?.id === "thomas-lied-about-poisoning"), false);
});

test("Thomas can return to factual testimony after an apology without reopening the false accusation", () => {
    const { engine, memory } = createDialogueHarness();
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning", value: "saw-poisoning"
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning-v2", topic: "kane-presence-during-poisoning",
        value: "near-victim-table-before-collapse", revisesClaimId: "waiter-kane-at-poisoning"
    });
    memory.recordAccusation("waiter", {
        id: "thomas-lied-about-poisoning", text: "Безосновательное обвинение"
    });
    memory.resolveAccusation("waiter", "thomas-lied-about-poisoning", "false", "Детектив признал ошибку");
    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.currentNode.id, "apology_acknowledged_opening");
    const followUp = engine.getAvailableAnswers().find(a => a.nextNode === "revised_testimony_opening");
    assert.equal(followUp?.isAvailable, true);
    engine.selectAnswer(followUp.index);
    assert.match(engine.currentNode.text, /не видел, как порошок/);
    assert.equal(engine.getAvailableAnswers().some(a => a.accusation?.id === "thomas-lied-about-poisoning"), false,
        "the accusation must not be repeatable after it is resolved");
    assert.equal(memory.getAccusationStatus("waiter", "thomas-lied-about-poisoning"), "false");
    assert.equal(memory.getAccusations("waiter").length, 1);
});

test("Thomas's protection promise needs a real family confirmation, not just Kane's confession", () => {
    const { engine, memory, inventory } = createDialogueHarness();
    memory.recordPromise("waiter", {
        id: "thomas-family-protection", text: "Обеспечить безопасность семьи Томаса",
        caseId: "case-002", fulfillment: { type: "insight_gained", insightId: "thomas_family_protected" }
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning", value: "saw-poisoning"
    });
    inventory.insights.push("full_confession_kane");
    assert.equal(memory.resolvePromisesForEvent({
        type: "insight_gained", insightId: "full_confession_kane"
    }).length, 0);
    assert.equal(memory.getPromises("waiter")[0].status, "pending");

    let joeHasHelped = false;
    engine.setRelationshipService({
        hasCompletedInteraction(npcId, ruleId) {
            return npcId === "bartender" && ruleId === "joe-reassures-thomas-after-threat" && joeHasHelped;
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-bartender-case2");
    const arrangement = () => engine.getAvailableAnswers().find(a => a.nextNode === "joe_safe_lodging_arranged");
    assert.equal(arrangement(), undefined, "Joe must have independently supported Thomas first");
    joeHasHelped = true;
    assert.equal(arrangement()?.isAvailable, true);
    engine.selectAnswer(arrangement().index);
    assert.equal(engine.currentNode.id, "joe_safe_lodging_arranged");
    assert.equal(inventory.hasInsight("joe_arranged_safe_lodging"), true);
    assert.equal(inventory.hasInsight("thomas_family_protected"), false);
    assert.equal(memory.getPromises("waiter")[0].status, "pending");

    engine.startDialogue("dialogue-waiter");
    const confirmation = engine.getAvailableAnswers().find(a => a.nextNode === "family_safety_confirmed");
    assert.equal(confirmation?.isAvailable, true);
    engine.selectAnswer(confirmation.index);
    assert.equal(inventory.hasInsight("thomas_family_protected"), true);
    const resolved = memory.resolvePromisesForEvent({
        type: "insight_gained", insightId: "thomas_family_protected"
    });
    assert.equal(resolved.length, 1);
    assert.equal(memory.getPromises("waiter")[0].status, "fulfilled");
    assert.equal(memory.resolvePromisesForEvent({
        type: "insight_gained", insightId: "thomas_family_protected"
    }).length, 0);
    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.getAvailableAnswers().some(a => a.nextNode === "family_safety_confirmed"), false);
});

test("legacy pending Thomas protection promises migrate without losing testimony or rewards", () => {
    const { memory, context } = createDialogueHarness();
    memory.recordPromise("waiter", {
        id: "thomas-family-protection", text: "Защитить семью",
        fulfillment: { type: "insight_gained", insightId: "full_confession_kane" }
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning", value: "saw-poisoning"
    });
    const snapshot = memory.toJSON();
    context.savedLegacyThomas = snapshot;
    const loaded = vm.runInContext("NPCMemoryService.fromJSON(savedLegacyThomas, 'case-002')", context);
    const pending = loaded.getPromises("waiter")[0];
    assert.equal(pending.fulfillment.insightId, "thomas_family_protected");
    assert.equal(pending.status, "pending");
    assert.equal(loaded.hasClaim("waiter", "waiter-kane-at-poisoning"), true);
    assert.equal(loaded.resolvePromisesForEvent({
        type: "insight_gained", insightId: "full_confession_kane"
    }).length, 0);
});

test("leaking Thomas's first shelter blocks safety confirmation until a different relocation is verified", () => {
    const { engine, memory, inventory } = createDialogueHarness();
    memory.recordPromise("waiter", {
        id: "thomas-family-protection", text: "Обеспечить безопасность семьи",
        fulfillment: { type: "insight_gained", insightId: "thomas_family_protected" }
    });
    memory.recordClaim("waiter", {
        id: "waiter-kane-at-poisoning", topic: "kane-presence-during-poisoning", value: "saw-poisoning"
    });
    inventory.insights.push("full_confession_kane");
    engine.setRelationshipService({
        hasCompletedInteraction(npcId, ruleId) {
            return npcId === "bartender" && ruleId === "joe-reassures-thomas-after-threat";
        },
        toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-bartender-case2");
    const arrange = engine.getAvailableAnswers().find(a => a.nextNode === "joe_safe_lodging_arranged");
    assert.equal(arrange?.isAvailable, true);
    engine.selectAnswer(arrange.index);
    assert.equal(inventory.hasInsight("joe_arranged_safe_lodging"), true);

    engine.startDialogue("dialogue-bartender-case2");
    const leak = engine.getAvailableAnswers().find(a => a.nextNode === "joe_address_compromised");
    assert.equal(leak?.isAvailable, true);
    const joeTrustBeforeLeak = memory.getTrust("bartender");
    engine.selectAnswer(leak.index);
    assert.ok(memory.getTrust("bartender") < joeTrustBeforeLeak);
    assert.equal(inventory.hasInsight("thomas_family_address_exposed"), true);

    engine.startDialogue("dialogue-waiter");
    assert.equal(engine.getAvailableAnswers().some(a => a.nextNode === "family_safety_confirmed"), false);
    assert.equal(engine.getAvailableAnswers().some(a => a.nextNode === "family_safety_reconfirmed"), false);
    assert.equal(memory.resolvePromisesForEvent({
        type: "insight_gained", insightId: "full_confession_kane"
    }).length, 0);
    assert.equal(memory.getPromises("waiter")[0].status, "pending");

    engine.startDialogue("dialogue-bartender-case2");
    const relocate = engine.getAvailableAnswers().find(a => a.nextNode === "joe_emergency_relocation");
    assert.equal(relocate?.isAvailable, true);
    engine.selectAnswer(relocate.index);
    assert.equal(inventory.hasInsight("joe_relocated_family_after_leak"), true);
    engine.startDialogue("dialogue-waiter");
    const confirm = engine.getAvailableAnswers().find(a => a.nextNode === "family_safety_reconfirmed");
    assert.equal(confirm?.isAvailable, true);
    engine.selectAnswer(confirm.index);
    assert.equal(inventory.hasInsight("thomas_family_protected"), true);
    assert.equal(memory.resolvePromisesForEvent({
        type: "insight_gained", insightId: "thomas_family_protected"
    }).length, 1);
    assert.equal(memory.getPromises("waiter")[0].status, "fulfilled");
    assert.equal(inventory.hasInsight("thomas_family_address_exposed"), true,
        "recovery does not erase the recorded breach");
});

test("Joe's post-protection visitor warning remains unverified after Lora's independent check", () => {
    const { engine, inventory, memory } = createDialogueHarness();
    inventory.insights.push("thomas_family_protected");
    engine.startDialogue("dialogue-bartender-case2");
    const inquiry = engine.getAvailableAnswers().find(a => a.nextNode === "joe_reports_unknown_visitor");
    assert.equal(inquiry?.isAvailable, true);
    engine.selectAnswer(inquiry.index);
    assert.equal(inventory.hasInsight("unknown_visitor_asked_about_thomas"), true);
    assert.equal(inventory.hasInsight("thomas_family_address_exposed"), false);
    assert.equal(memory.getPromises("waiter").length, 0);

    engine.startDialogue("dialogue-journalist");
    const verify = engine.getAvailableAnswers().find(a => a.nextNode === "lora_checks_unknown_visitor");
    assert.equal(verify?.isAvailable, true);
    engine.selectAnswer(verify.index);
    assert.match(engine.currentNode.text, /не подтверждена/);
    assert.equal(inventory.hasInsight("unknown_visitor_unverified"), true);
    assert.equal(inventory.hasInsight("thomas_family_protected"), true);
    engine.startDialogue("dialogue-journalist");
    assert.equal(engine.getAvailableAnswers().some(a => a.nextNode === "lora_checks_unknown_visitor"), false);
});

test("Lora can check the visitor from her alternate opening after investigating Eva", () => {
    const { engine, inventory } = createDialogueHarness();
    inventory.insights.push("unknown_visitor_asked_about_thomas");
    engine.setRelationshipService({
        getInvestigationOutcome(npcId, ruleId) {
            return npcId === "journalist" && ruleId === "lora-interviews-eva-about-threat"
                ? "no_independent_evidence" : null;
        }, toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-journalist");
    assert.equal(engine.currentNode.id, "lora_second_check_opening");
    assert.equal(engine.getAvailableAnswers().find(a => a.nextNode === "lora_checks_unknown_visitor")?.isAvailable, true);
});

test("Joe's opening tracks the shelter breach, relocation, and verified safety without trapping the dialogue", () => {
    const { engine, inventory } = createDialogueHarness();
    engine.startDialogue("dialogue-bartender-case2");
    assert.equal(engine.currentNode.id, "greeting");

    inventory.insights.push("thomas_family_address_exposed");
    engine.startDialogue("dialogue-bartender-case2");
    assert.equal(engine.currentNode.id, "joe_after_leak_opening");
    const relocate = engine.getAvailableAnswers().find(a => a.nextNode === "joe_emergency_relocation");
    assert.equal(relocate?.isAvailable, true);
    engine.selectAnswer(relocate.index);
    assert.equal(inventory.hasInsight("joe_relocated_family_after_leak"), true);

    engine.startDialogue("dialogue-bartender-case2");
    assert.equal(engine.currentNode.id, "joe_after_relocation_opening");
    const returnToCase = engine.getAvailableAnswers().find(a => a.nextNode === "greeting");
    assert.equal(returnToCase?.isAvailable, true);
    engine.selectAnswer(returnToCase.index);
    assert.equal(engine.currentNode.id, "greeting");

    inventory.insights.push("thomas_family_protected");
    engine.startDialogue("dialogue-bartender-case2");
    assert.equal(engine.currentNode.id, "joe_after_protection_verified_opening");
    assert.match(engine.currentNode.text, /подтвердил/);
    assert.equal(engine.getAvailableAnswers().find(a => a.nextNode === "greeting")?.isAvailable, true);
});

test("Joe does not imply a leak when the family was protected without one", () => {
    const { engine, inventory } = createDialogueHarness();
    inventory.insights.push("thomas_family_protected");
    engine.startDialogue("dialogue-bartender-case2");
    assert.equal(engine.currentNode.id, "greeting");
});

test("the anonymous visitor lead gains corroboration from a second record without becoming a proven Kane threat", () => {
    const { engine, inventory } = createDialogueHarness();
    inventory.insights.push("thomas_family_protected", "unknown_visitor_asked_about_thomas", "unknown_visitor_unverified");
    engine.startDialogue("dialogue-bartender-case2");
    const log = engine.getAvailableAnswers().find(a => a.nextNode === "joe_finds_visitor_log");
    assert.equal(log?.isAvailable, true);
    engine.selectAnswer(log.index);
    assert.equal(inventory.hasInsight("joe_found_inspection_entry"), true);
    assert.equal(inventory.hasInsight("visitor_likely_inspector"), false);

    engine.startDialogue("dialogue-journalist");
    const check = engine.getAvailableAnswers().find(a => a.nextNode === "lora_verifies_inspection_schedule");
    assert.equal(check?.isAvailable, true);
    engine.selectAnswer(check.index);
    assert.match(engine.currentNode.text, /наиболее вероятно/);
    assert.match(engine.currentNode.text, /без прямого опознания/);
    assert.equal(inventory.hasInsight("visitor_likely_inspector"), true);
    assert.equal(inventory.hasInsight("thomas_family_protected"), true);
    assert.equal(inventory.hasInsight("thomas_family_address_exposed"), false);
    engine.startDialogue("dialogue-journalist");
    assert.equal(engine.getAvailableAnswers().some(a => a.nextNode === "lora_verifies_inspection_schedule"), false);
});

test("Lora can corroborate the visitor record from her contextual Eva follow-up", () => {
    const { engine, inventory } = createDialogueHarness();
    inventory.insights.push("joe_found_inspection_entry");
    engine.setRelationshipService({
        getInvestigationOutcome(npcId, ruleId) {
            return npcId === "journalist" && ruleId === "lora-interviews-eva-about-threat"
                ? "no_independent_evidence" : null;
        }, toJSON() { return {}; }
    });
    engine.startDialogue("dialogue-journalist");
    assert.equal(engine.currentNode.id, "lora_second_check_opening");
    assert.equal(engine.getAvailableAnswers().find(a => a.nextNode === "lora_verifies_inspection_schedule")?.isAvailable, true);
});

test("overstating the visitor's identity is challenged by Joe after Lora reports the detective's conclusion", () => {
    const { engine, memory, inventory, advance } = createDialogueHarness();
    inventory.insights.push("joe_found_inspection_entry");

    engine.startDialogue("dialogue-journalist");
    const verify = engine.getAvailableAnswers().find(answer => answer.nextNode === "lora_verifies_inspection_schedule");
    assert.equal(verify?.isAvailable, true);
    engine.selectAnswer(verify.index);
    assert.equal(inventory.hasInsight("visitor_likely_inspector"), true);

    const overclaim = engine.getAvailableAnswers().find(answer => answer.nextNode === "lora_rejects_certain_visitor_identity");
    assert.equal(overclaim?.isAvailable, true);
    engine.selectAnswer(overclaim.index);
    assert.equal(memory.hasLongTermMemoryTag("journalist", "player_overstated_visitor_identity"), true);
    assert.equal(memory.hasRumor("bartender", "detective-overstated-visitor-identity"), false);

    advance(30);
    assert.equal(memory.hasRumor("bartender", "detective-overstated-visitor-identity"), true);

    engine.startDialogue("dialogue-bartender-case2");
    const challenge = engine.getAvailableAnswers().find(answer => answer.nextNode === "joe_challenges_visitor_overclaim");
    assert.equal(challenge?.isAvailable, true);
    engine.selectAnswer(challenge.index);
    assert.equal(engine.currentNode.id, "joe_challenges_visitor_overclaim");
    assert.equal(inventory.hasInsight("joe_challenged_overstated_visitor_identity"), true);

    const correction = engine.getAvailableAnswers().find(answer => answer.text.includes("оставлю личность посетителя неподтверждённой"));
    assert.equal(correction?.isAvailable, true);
    engine.selectAnswer(correction.index);
    assert.equal(memory.hasLongTermMemoryTag("bartender", "player_corrected_visitor_overclaim"), true);

    engine.startDialogue("dialogue-bartender-case2");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "joe_challenges_visitor_overclaim"), false);
});

test("a cautious visitor assessment does not create a rumor or damage the journalist relationship", () => {
    const { engine, memory, inventory, advance } = createDialogueHarness();
    inventory.insights.push("joe_found_inspection_entry");

    engine.startDialogue("dialogue-journalist");
    const verify = engine.getAvailableAnswers().find(answer => answer.nextNode === "lora_verifies_inspection_schedule");
    engine.selectAnswer(verify.index);
    const cautious = engine.getAvailableAnswers().find(answer => answer.text.includes("Отмечу объяснение как вероятное"));
    assert.equal(cautious?.isAvailable, true);
    engine.selectAnswer(cautious.index);

    assert.equal(memory.hasLongTermMemoryTag("journalist", "player_respected_visitor_uncertainty"), true);
    advance(60);
    assert.equal(memory.hasRumor("bartender", "detective-overstated-visitor-identity"), false);
});

test("official cancellation record and direct witness identification distinguish appointment, attendance and identity", () => {
    const { engine, inventory, memory, emitted } = createDialogueHarness();
    inventory.insights.push("joe_found_inspection_entry");

    engine.startDialogue("dialogue-labour-inspector");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "rudenko_checks_register"), false);

    inventory.addInsight("inspection_cancellation_record");
    engine.startDialogue("dialogue-labour-inspector");
    const verifyRegister = engine.getAvailableAnswers().find(answer => answer.nextNode === "rudenko_checks_register");
    assert.equal(verifyRegister?.isAvailable, true);
    engine.selectAnswer(verifyRegister.index);
    assert.equal(inventory.hasInsight("rudenko_denies_visit"), true);

    const verifyIdentity = engine.getAvailableAnswers().find(answer => answer.nextNode === "rudenko_identity_documents");
    assert.equal(verifyIdentity?.isAvailable, true);
    engine.selectAnswer(verifyIdentity.index);
    assert.equal(inventory.hasInsight("rudenko_identity_documents_verified"), true);
    assert.equal(emitted.some(event => event.name === "evidence:from_dialogue" && event.payload.evidenceId === "inspector_service_card"), true);

    const accompany = engine.getAvailableAnswers().find(answer => answer.nextNode === "rudenko_agrees_to_identification");
    assert.equal(accompany?.isAvailable, true);
    engine.selectAnswer(accompany.index);
    assert.equal(inventory.hasInsight("rudenko_agreed_to_identification"), true);

    engine.startDialogue("dialogue-bartender-case2");
    const identification = engine.getAvailableAnswers().find(answer => answer.nextNode === "joe_identifies_different_visitor");
    assert.equal(identification?.isAvailable, true);
    engine.selectAnswer(identification.index);
    assert.equal(inventory.hasInsight("joe_rules_out_rudenko"), true);
    assert.match(engine.currentNode.text, /не тот человек/);
    assert.match(engine.currentNode.text, /не говорит, кто именно приходил/);

    const careful = engine.getAvailableAnswers().find(answer => answer.text.toLowerCase().includes("личность неизвестного оставим открытым"));
    assert.equal(careful?.isAvailable, true);
    engine.selectAnswer(careful.index);
    assert.equal(memory.hasLongTermMemoryTag("bartender", "player_completed_cautious_identification"), true);
});

test("the inspector's denial cannot be obtained from the appointment record alone", () => {
    const { engine, inventory } = createDialogueHarness();
    inventory.insights.push("joe_found_inspection_entry");
    engine.startDialogue("dialogue-labour-inspector");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "rudenko_checks_register"), false);
    assert.equal(inventory.hasInsight("rudenko_denies_visit"), false);
});

test("unknown visitor description unlocks an independent but non-identifying tram route lead", () => {
    const { engine, inventory, memory, emitted } = createDialogueHarness();
    inventory.insights.push(
        "joe_found_inspection_entry",
        "inspection_cancellation_record",
        "rudenko_denies_visit",
        "rudenko_agreed_to_identification"
    );

    engine.startDialogue("dialogue-bartender-case2");
    const identify = engine.getAvailableAnswers().find(answer => answer.nextNode === "joe_identifies_different_visitor");
    assert.equal(identify?.isAvailable, true);
    engine.selectAnswer(identify.index);
    const describe = engine.getAvailableAnswers().find(answer => answer.nextNode === "joe_describes_unknown_visitor");
    assert.equal(describe?.isAvailable, true);
    engine.selectAnswer(describe.index);
    assert.equal(inventory.hasInsight("unknown_visitor_description"), true);
    assert.match(engine.currentNode.text, /повязку/);
    assert.match(engine.currentNode.text, /не.*опозн/);

    engine.startDialogue("dialogue-tram-conductor");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "checks_route_book"), true);
    const checkRoute = engine.getAvailableAnswers().find(answer => answer.nextNode === "checks_route_book");
    engine.selectAnswer(checkRoute.index);
    assert.equal(inventory.hasInsight("tram_passenger_route_corroboration"), true);
    assert.equal(emitted.some(event => event.name === "evidence:from_dialogue" && event.payload.evidenceId === "tram_route_entry"), true);
    assert.match(engine.currentNode.text, /не могу утверждать, что это тот самый человек/);

    const cautious = engine.getAvailableAnswers().find(answer => answer.text.includes("Это независимая зацепка"));
    assert.equal(cautious?.isAvailable, true);
    engine.selectAnswer(cautious.index);
    assert.equal(memory.hasLongTermMemoryTag("tram_conductor", "player_kept_route_lead_unconfirmed"), true);
});

test("tram conductor cannot offer a route match before receiving the witness description", () => {
    const { engine, inventory } = createDialogueHarness();
    engine.startDialogue("dialogue-tram-conductor");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "checks_route_book"), false);
    assert.equal(inventory.hasInsight("tram_passenger_route_corroboration"), false);
});

test("mill watchman provides a limited gate-log result without identifying the unknown visitor", () => {
    const { engine, inventory, memory, emitted } = createDialogueHarness();
    engine.startDialogue("dialogue-mill-watchman");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "checks_shift_log"), false);

    inventory.addInsight("tram_passenger_route_corroboration");
    engine.startDialogue("dialogue-mill-watchman");
    const check = engine.getAvailableAnswers().find(answer => answer.nextNode === "checks_shift_log");
    assert.equal(check?.isAvailable, true);
    engine.selectAnswer(check.index);

    assert.equal(inventory.hasInsight("mill_gate_seal_intact"), true);
    assert.equal(emitted.some(event => event.name === "evidence:from_dialogue" && event.payload.evidenceId === "mill_shift_extract"), true);
    assert.match(engine.currentNode.text, /не могу сказать, куда человек пошёл/);

    const cautious = engine.getAvailableAnswers().find(answer => answer.nextNode === "records_limits");
    assert.equal(cautious?.isAvailable, true);
    engine.selectAnswer(cautious.index);
    assert.equal(inventory.hasInsight("mill_no_registered_visitors"), true);
    assert.equal(memory.hasLongTermMemoryTag("mill_watchman", "player_respected_record_scope"), true);
});

test("mill gate ledger does not prove the unknown visitor was absent from the entire district", () => {
    const { engine, inventory } = createDialogueHarness();
    inventory.addInsight("tram_passenger_route_corroboration");
    engine.startDialogue("dialogue-mill-watchman");
    const check = engine.getAvailableAnswers().find(answer => answer.nextNode === "checks_shift_log");
    engine.selectAnswer(check.index);
    const overclaim = engine.getAvailableAnswers().find(answer => answer.nextNode === "overstates_factory_record");
    assert.equal(overclaim?.isAvailable, true);
    engine.selectAnswer(overclaim.index);
    assert.match(engine.currentNode.text, /не за весь район/);
});

test("diner witness provides a cautious possible match and an explicitly unreliable time", () => {
    const { engine, inventory, memory, emitted } = createDialogueHarness();
    engine.startDialogue("dialogue-diner-owner");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "recalls_customer"), false);

    inventory.addInsight("unknown_visitor_description");
    engine.startDialogue("dialogue-diner-owner");
    const prompt = engine.getAvailableAnswers().find(answer => answer.nextNode === "recalls_customer");
    assert.equal(prompt?.isAvailable, true);
    engine.selectAnswer(prompt.index);

    assert.equal(inventory.hasInsight("diner_possible_matching_customer"), true);
    assert.equal(emitted.some(event => event.name === "evidence:from_dialogue" && event.payload.evidenceId === "diner_cash_slip"), true);
    assert.match(engine.currentNode.text, /не поручусь, что это тот же человек/);

    const askDirection = engine.getAvailableAnswers().find(answer => answer.nextNode === "direction_uncertain");
    assert.equal(askDirection?.isAvailable, true);
    engine.selectAnswer(askDirection.index);
    assert.equal(inventory.hasInsight("diner_time_unverified"), true);
    assert.match(engine.currentNode.text, /не видела, как он вышел/);
    assert.match(engine.currentNode.text, /часы кассы никто не сверял/);

    const careful = engine.getAvailableAnswers().find(answer => answer.text.includes("время остаётся приблизительным"));
    assert.equal(careful?.isAvailable, true);
    engine.selectAnswer(careful.index);
    assert.equal(memory.hasLongTermMemoryTag("diner_owner", "player_recorded_diner_clock_uncertainty"), true);
});

test("diner owner rejects treating an uncertain recollection as identification", () => {
    const { engine, inventory, memory } = createDialogueHarness();
    inventory.addInsight("unknown_visitor_description");
    engine.startDialogue("dialogue-diner-owner");
    const recall = engine.getAvailableAnswers().find(answer => answer.nextNode === "recalls_customer");
    engine.selectAnswer(recall.index);
    const overclaim = engine.getAvailableAnswers().find(answer => answer.nextNode === "rejects_early_identification");
    assert.equal(overclaim?.isAvailable, true);
    engine.selectAnswer(overclaim.index);
    assert.match(engine.currentNode.text, /не видела, как он садился в трамвай/);
    assert.equal(memory.hasLongTermMemoryTag("diner_owner", "player_overstated_diner_match"), true);
});

test("telephone exchange records a district request but cannot identify the caller or destination number", () => {
    const { engine, inventory, memory, emitted } = createDialogueHarness();
    engine.startDialogue("dialogue-telephone-operator");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "checks_service_register"), false);

    inventory.addInsight("diner_possible_matching_customer");
    inventory.addInsight("textile_street_phone_line");
    engine.startDialogue("dialogue-telephone-operator");
    const check = engine.getAvailableAnswers().find(answer => answer.nextNode === "checks_service_register");
    assert.equal(check?.isAvailable, true);
    engine.selectAnswer(check.index);

    assert.equal(inventory.hasInsight("telephone_exchange_request_record"), true);
    assert.equal(emitted.some(event => event.name === "evidence:from_dialogue" && event.payload.evidenceId === "telephone_exchange_slip"), true);
    assert.match(engine.currentNode.text, /номером абонента/);
    assert.match(engine.currentNode.text, /не подтверждение, что разговор состоялся/);

    const cautious = engine.getAvailableAnswers().find(answer => answer.nextNode === "limits_record");
    assert.equal(cautious?.isAvailable, true);
    engine.selectAnswer(cautious.index);
    assert.equal(inventory.hasInsight("telephone_time_calibrated"), true);
    assert.equal(memory.hasLongTermMemoryTag("telephone_operator", "player_respected_telephone_record_limits"), true);
});

test("telephone exchange rejects attributing an unassigned request to the diner visitor", () => {
    const { engine, inventory, memory } = createDialogueHarness();
    inventory.addInsight("diner_possible_matching_customer");
    inventory.addInsight("textile_street_phone_line");
    engine.startDialogue("dialogue-telephone-operator");
    const check = engine.getAvailableAnswers().find(answer => answer.nextNode === "checks_service_register");
    engine.selectAnswer(check.index);
    const overclaim = engine.getAvailableAnswers().find(answer => answer.nextNode === "overstates_record");
    assert.equal(overclaim?.isAvailable, true);
    engine.selectAnswer(overclaim.index);
    assert.match(engine.currentNode.text, /нет имени, номера аппарата/);
    assert.equal(memory.hasLongTermMemoryTag("telephone_operator", "player_overstated_telephone_match"), true);
});

test("telephone technician narrows the fault to booth T-17 without identifying the source of the district request", () => {
    const { engine, inventory, memory, emitted } = createDialogueHarness();
    engine.startDialogue("dialogue-line-technician");
    assert.equal(engine.getAvailableAnswers().some(answer => answer.nextNode === "checks_booth_ticket"), false);

    inventory.addInsight("telephone_time_calibrated");
    engine.startDialogue("dialogue-line-technician");
    const check = engine.getAvailableAnswers().find(answer => answer.nextNode === "checks_booth_ticket");
    assert.equal(check?.isAvailable, true);
    engine.selectAnswer(check.index);

    assert.equal(inventory.hasInsight("booth_t17_fault_window"), true);
    assert.equal(emitted.some(event => event.name === "evidence:from_dialogue" && event.payload.evidenceId === "booth_t17_maintenance_ticket"), true);
    assert.match(engine.currentNode.text, /другого аппарата/);

    const cautious = engine.getAvailableAnswers().find(answer => answer.nextNode === "record_scope");
    assert.equal(cautious?.isAvailable, true);
    engine.selectAnswer(cautious.index);
    assert.equal(inventory.hasInsight("booth_t17_not_confirmed_source"), true);
    assert.equal(memory.hasLongTermMemoryTag("line_technician", "player_kept_phone_fault_scope"), true);
});

test("technician rejects claiming the whole district line was down based on one booth ticket", () => {
    const { engine, inventory, memory } = createDialogueHarness();
    inventory.addInsight("telephone_time_calibrated");
    engine.startDialogue("dialogue-line-technician");
    const check = engine.getAvailableAnswers().find(answer => answer.nextNode === "checks_booth_ticket");
    engine.selectAnswer(check.index);
    const overclaim = engine.getAvailableAnswers().find(answer => answer.nextNode === "overstates_fault");
    assert.equal(overclaim?.isAvailable, true);
    engine.selectAnswer(overclaim.index);
    assert.match(engine.currentNode.text, /все аппараты района/);
    assert.equal(memory.hasLongTermMemoryTag("line_technician", "player_overstated_phone_fault"), true);
});

test("Thomas remembers a fulfilled promise in his next conversation", () => {
    const { engine, memory } = createDialogueHarness();
    const promise = {
        id: "thomas-family-protection", text: "Я обеспечу безопасность твоей семьи.",
        fulfillment: { type: "insight_gained", insightId: "thomas_family_protected" }
    };
    assert.equal(memory.recordPromise("waiter", promise).recorded, true);
    assert.equal(engine.startDialogue("dialogue-waiter"), true);
    assert.equal(engine._checkCondition("promise_status:thomas-family-protection:pending"), true);
    engine.reset();

    assert.equal(memory.resolvePromisesForEvent({
        type: "insight_gained", insightId: "thomas_family_protected"
    }).length, 1);
    assert.equal(engine.startDialogue("dialogue-waiter"), true);
    assert.equal(engine.currentNode.id, "promise_kept_opening");
    assert.match(engine.currentNode.text, /в безопасности/);
    assert.equal(engine._checkCondition("promise_status:thomas-family-protection:fulfilled"), true);
    assert.equal(engine._checkCondition("promise_status:thomas-family-protection:broken"), false);
    engine.reset();
    assert.equal(engine.startDialogue("dialogue-waiter"), true);
    assert.notEqual(engine.currentNode.id, "promise_kept_opening");
});

test("Thomas remembers a broken promise after a failed investigation", () => {
    const { engine, memory } = createDialogueHarness();
    memory.recordPromise("waiter", {
        id: "thomas-family-protection", text: "Я обеспечу безопасность твоей семьи.",
        fulfillment: { type: "insight_gained", insightId: "thomas_family_protected" }
    });
    assert.equal(memory.settlePromisesForCase("case-002", "failed").length, 1);
    assert.equal(engine.startDialogue("dialogue-waiter"), true);
    assert.equal(engine.currentNode.id, "promise_broken_opening");
    assert.match(engine.currentNode.text, /обещали/);
    assert.equal(engine._checkCondition("promise_status:thomas-family-protection:broken"), true);
});
