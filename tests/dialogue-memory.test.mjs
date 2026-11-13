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
            ex_wife: { name: "Анна", availableForCall: true },
            woman_in_red: { name: "Ева", availableForCall: false }
        })[id] || null; },
        getObjectById(id) { return ({ bar_photo: { id, name: "Фотография из бара", icon: "📸", isEvidence: true }, poison_vial: { id, name: "Пузырёк с ядом", isEvidence: true } })[id] || null; }
    });

    for (const path of [
        "assets/js/npc/npcMemoryService.js",
        "assets/js/npc/npcMotivationService.js",
        "assets/js/npc/npcSocialNetwork.js",
        "assets/js/npc/dialogueEngine.js",
        "assets/data/cases/case-002/dialogues/waiter.js",
        "assets/data/cases/case-002/dialogues/bartender_case2.js",
        "assets/data/cases/case-002/dialogues/journalist.js",
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
                    { from: "bartender", to: "journalist", relationship: "source", trust: 65, channel: "message", delayMinutes: 30, minTrustToShare: 50, shareTypes: ["detective_behavior"], canForward: true }
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
        answer.condition === "long_term_memory:player_threatened" && answer.isAvailable
    ), false);
    assert.equal(engine.getAvailableAnswers().some(answer =>
        answer.condition === "long_term_memory:player_reassured" && answer.isAvailable
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
        answer.condition === "long_term_memory:player_threatened"
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
        answer.condition === "long_term_memory:player_reassured"
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
    assert.equal(promises[0].fulfillment.insightId, "full_confession_kane");
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
