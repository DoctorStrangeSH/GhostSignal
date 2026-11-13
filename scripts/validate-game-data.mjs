import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(".");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const dataScripts = html.split("<script src=").slice(1).map(chunk => chunk.match(/^["']([^"']+)["']/)?.[1]).filter(path => path?.startsWith("assets/data/") && path.endsWith(".js"));

if (dataScripts.length === 0) {
    process.stderr.write("No game data scripts were found in index.html." + String.fromCharCode(10));
    process.exit(1);
}

const sandbox = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    window: {}
});

for (const scriptPath of dataScripts) {
    const source = readFileSync(resolve(root, scriptPath), "utf8");
    vm.runInContext(source, sandbox, { filename: scriptPath });
}

vm.runInContext(
    "globalThis.__ghostSignalData = { cases: CASES_INDEX, locations: window.LOCATIONS_INDEX, npcs: window.NPCS_INDEX, objects: window.OBJECTS_INDEX, dialogues: window.DIALOGUES_INDEX, evidenceChains: window.EVIDENCE_CHAINS, endings: window.ENDINGS };",
    sandbox
);

const data = sandbox.__ghostSignalData;
const errors = [];
const insightSources = new Set();
const acquirableItems = new Set();
const dialogueReferences = new Set();
const authoredLongTermMemoryTags = new Set();
const longTermMemoryConditions = [];
const npcGoalConditions = [];
const authoredNpcGoals = new Set();
const npcClaimConditions = [];
const authoredNpcClaims = new Set();
const authoredNpcClaimTopics = new Set();
const expandCondition = condition => {
    if (typeof condition !== "string" || !condition) return [];
    const compound = condition.match(/^(all|any):(.*)$/);
    return compound ? compound[2].split("&").flatMap(part => expandCondition(part.trim())) : [condition];
};
const checkRef = (registry, id, label) => {
    if (typeof id === "string" && id && !registry[id]) errors.push(label + " references missing ID: " + id);
};

for (const [id, location] of Object.entries(data.locations)) {
    if (location.id !== id) errors.push("Location key/id mismatch: " + id);
    if (!location.hours || !Number.isFinite(location.hours.open) || !Number.isFinite(location.hours.close)) {
        errors.push("Location has invalid opening hours: " + id);
    } else if (location.hours.open < 0 || location.hours.open > 23 || location.hours.close < 0 || location.hours.close > 24) {
        errors.push("Location hours are outside the 0–24 range: " + id);
    }
    if (location.requiresItem) checkRef(data.objects, location.requiresItem, "Location " + id + " requirement");
    for (const itemId of [...(location.defaultItems || []), ...(location.nightOnlyItems || [])]) {
        checkRef(data.objects, itemId, "Location " + id);
        acquirableItems.add(itemId);
    }
    for (const npcId of location.npcsPresent || []) checkRef(data.npcs, npcId, "Location " + id);
    if (location.parentLocation) checkRef(data.locations, location.parentLocation, "Location " + id);
    if (location.mapPosition) {
        const { x, y } = location.mapPosition;
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
            errors.push("Location has invalid map coordinates: " + id);
        }
    }
}

for (const [id, npc] of Object.entries(data.npcs)) {
    if (npc.id !== id) errors.push("NPC key/id mismatch: " + id);
    if (npc.dialogueId) {
        checkRef(data.dialogues, npc.dialogueId, "NPC " + id);
        dialogueReferences.add(npc.dialogueId);
    }
    for (const itemId of npc.canGiveEvidence || []) {
        checkRef(data.objects, itemId, "NPC " + id);
        acquirableItems.add(itemId);
    }
    for (const insightId of npc.canGiveInsights || []) insightSources.add(insightId);
    const psychology = npc.psychology || {};
    if (psychology.cooperationResistance !== undefined &&
        (!Number.isFinite(psychology.cooperationResistance) || psychology.cooperationResistance < 0 || psychology.cooperationResistance > 1)) {
        errors.push("NPC has invalid cooperation resistance: " + id);
    }
    if (psychology.cooperationThresholds !== undefined) {
        const thresholds = psychology.cooperationThresholds;
        const values = ["withdrawn", "reluctant", "guarded", "willing"].map(key => thresholds?.[key]);
        if (values.some(value => !Number.isFinite(value) || value < 0 || value > 100) ||
            values.some((value, index) => index > 0 && value <= values[index - 1])) {
            errors.push("NPC has invalid cooperation thresholds: " + id);
        }
    }
    for (const condition of npc.specialConditions || []) {
        if (condition.dialogueId) {
            checkRef(data.dialogues, condition.dialogueId, "NPC condition " + id);
            dialogueReferences.add(condition.dialogueId);
        }
        if (condition.condition?.startsWith("hasItem:")) checkRef(data.objects, condition.condition.slice(8), "NPC condition " + id);
        if (condition.condition?.startsWith("hasInsight:")) insightSources.add(condition.condition.slice(11));
    }
    for (const hour of [npc.schedule?.awake?.start, npc.schedule?.awake?.end, npc.schedule?.sleeps?.start, npc.schedule?.sleeps?.end, npc.schedule?.atWork?.start, npc.schedule?.atWork?.end]) {
        if (hour !== undefined && (!Number.isInteger(hour) || hour < 0 || hour > 23)) errors.push("NPC has invalid schedule hour: " + id + " (" + hour + ")");
    }
    for (const locationId of Object.values(npc.schedule?.locations || {})) {
        if (locationId) checkRef(data.locations, locationId, "NPC schedule " + id);
    }
}

for (const [id, object] of Object.entries(data.objects)) {
    if (object.id !== id) errors.push("Object key/id mismatch: " + id);
    for (const [action, interaction] of Object.entries(object.interactions || {})) {
        if (interaction.spawnsItem) {
            checkRef(data.objects, interaction.spawnsItem, "Object " + id + "/" + action);
            acquirableItems.add(interaction.spawnsItem);
        }
        if (interaction.givesInsight) insightSources.add(interaction.givesInsight);
        if (interaction.revealsObject) {
            checkRef(data.objects, interaction.revealsObject, "Object " + id + "/" + action);
            acquirableItems.add(interaction.revealsObject);
        }
        if (interaction.requiresItem) checkRef(data.objects, interaction.requiresItem, "Object " + id + "/" + action);
        if (interaction.condition?.startsWith("hasItem:")) checkRef(data.objects, interaction.condition.slice(8), "Object condition " + id);
        if (interaction.condition?.startsWith("hasInsight:")) insightSources.add(interaction.condition.slice(11));
    }
}

for (const [id, dialogue] of Object.entries(data.dialogues)) {
    if (dialogue.id !== id) errors.push("Dialogue key/id mismatch: " + id);
    if (dialogue.npcId) checkRef(data.npcs, dialogue.npcId, "Dialogue " + id);
    const nodes = dialogue.tree?.nodes || {};
    if (!dialogue.tree?.start || !nodes[dialogue.tree.start]) {
        errors.push("Dialogue has missing start node: " + id);
    }

    const reachableNodes = new Set();
    const pendingNodes = dialogue.tree?.start && nodes[dialogue.tree.start] ? [dialogue.tree.start] : [];
    while (pendingNodes.length) {
        const currentNodeId = pendingNodes.pop();
        if (reachableNodes.has(currentNodeId)) continue;
        reachableNodes.add(currentNodeId);
        for (const answer of nodes[currentNodeId]?.answers || []) {
            if (answer.nextNode && nodes[answer.nextNode] && !reachableNodes.has(answer.nextNode)) pendingNodes.push(answer.nextNode);
        }
    }

    for (const nodeId of Object.keys(nodes)) {
        if (!reachableNodes.has(nodeId)) errors.push("Dialogue " + id + " contains unreachable node: " + nodeId);
    }

    if (!dialogueReferences.has(id)) errors.push("Dialogue is not linked to any NPC: " + id);

    for (const [nodeId, node] of Object.entries(nodes)) {
        if (node.givesEvidence) {
            checkRef(data.objects, node.givesEvidence, "Dialogue " + id + "/" + nodeId);
            acquirableItems.add(node.givesEvidence);
        }
        if (node.spawnsItem) {
            checkRef(data.objects, node.spawnsItem, "Dialogue " + id + "/" + nodeId);
            acquirableItems.add(node.spawnsItem);
        }
        if (node.givesInsight) insightSources.add(node.givesInsight);
        if (node.claim?.id) authoredNpcClaims.add(dialogue.npcId + ":" + node.claim.id);
        if (node.claim?.topic) authoredNpcClaimTopics.add(dialogue.npcId + ":" + node.claim.topic);
        if (node.claim?.revisesActiveClaimTopic !== undefined && node.claim.revisesActiveClaimTopic !== true) {
            errors.push("Dialogue " + id + "/" + nodeId + " has an invalid active-topic claim revision flag.");
        }
        for (const answer of node.answers || []) {
            if (answer.condition?.startsWith("hasItem:")) checkRef(data.objects, answer.condition.slice(8), "Dialogue condition " + id + "/" + nodeId);
            if (answer.condition?.startsWith("hasInsight:")) insightSources.add(answer.condition.slice(11));
            if (Array.isArray(answer.memoryTags)) {
                for (const tag of answer.memoryTags) {
                    if (typeof tag !== "string" || !/^[a-z0-9_:-]{1,48}$/i.test(tag)) {
                        errors.push("Dialogue " + id + "/" + nodeId + " has an invalid long-term memory tag.");
                    } else {
                        authoredLongTermMemoryTags.add(tag);
                    }
                }
            }
            if (answer.memoryImportance !== undefined &&
                (!Number.isInteger(answer.memoryImportance) || answer.memoryImportance < 1 || answer.memoryImportance > 5)) {
                errors.push("Dialogue " + id + "/" + nodeId + " has invalid memoryImportance.");
            }
            if (answer.memorySummary !== undefined &&
                (typeof answer.memorySummary !== "string" || answer.memorySummary.length > 220)) {
                errors.push("Dialogue " + id + "/" + nodeId + " has an invalid memorySummary.");
            }
            if (answer.cooperationDelta !== undefined &&
                (!Number.isFinite(answer.cooperationDelta) || answer.cooperationDelta < -25 || answer.cooperationDelta > 25)) {
                errors.push("Dialogue " + id + "/" + nodeId + " has an invalid cooperationDelta.");
            }
            if (answer.hiddenWhenUnavailable !== undefined && typeof answer.hiddenWhenUnavailable !== "boolean") {
                errors.push("Dialogue " + id + "/" + nodeId + " has an invalid hiddenWhenUnavailable flag.");
            }
            for (const field of ["fulfilledCooperationDelta", "brokenCooperationDelta"]) {
                if (answer.promise?.[field] !== undefined &&
                    (!Number.isFinite(answer.promise[field]) || answer.promise[field] < -25 || answer.promise[field] > 25)) {
                    errors.push("Dialogue " + id + "/" + nodeId + " has an invalid promise " + field + ".");
                }
            }
            for (const condition of expandCondition(answer.condition)) {
                if (condition.startsWith("has_claim:")) {
                    const claimId = condition.slice("has_claim:".length);
                    if (!/^[a-z0-9_:-]{1,80}$/i.test(claimId)) errors.push("Dialogue " + id + "/" + nodeId + " has an invalid active-claim condition.");
                    else npcClaimConditions.push({ npcId: dialogue.npcId, claimId, dialogueId: id, nodeId });
                }
                if (condition.startsWith("has_claim_topic:")) {
                    const topic = condition.slice("has_claim_topic:".length);
                    if (!/^[a-z0-9_:-]{1,80}$/i.test(topic)) errors.push("Dialogue " + id + "/" + nodeId + " has an invalid active-claim topic condition.");
                    else if (!authoredNpcClaimTopics.has(dialogue.npcId + ":" + topic)) {
                        npcClaimConditions.push({ npcId: dialogue.npcId, topic, dialogueId: id, nodeId });
                    }
                }
                const cooperationCondition = condition.match(/^cooperation_(at_least|below):([0-9]+(?:[.][0-9]+)?)$/);
                if (/^cooperation_(at_least|below):/.test(condition) && !cooperationCondition) {
                    errors.push("Dialogue " + id + "/" + nodeId + " has an invalid cooperation threshold condition.");
                }
                if (cooperationCondition && Number(cooperationCondition[2]) > 100) {
                    errors.push("Dialogue " + id + "/" + nodeId + " has an out-of-range cooperation threshold.");
                }
                if (condition.startsWith("cooperation_state:") &&
                    !["withdrawn", "reluctant", "guarded", "willing", "ready"].includes(condition.slice("cooperation_state:".length))) {
                    errors.push("Dialogue " + id + "/" + nodeId + " has an invalid cooperation state condition.");
                }
                const rumorStatusCondition = condition.match(/^rumor_status:([a-z0-9_:-]{1,80}):(unverified|corroborated|disputed)$/i);
                if (condition.startsWith("rumor_status:") && !rumorStatusCondition) {
                    errors.push("Dialogue " + id + "/" + nodeId + " has an invalid rumor status condition.");
                }
                const rumorConfidenceCondition = condition.match(/^rumor_confidence_at_least:([a-z0-9_:-]{1,80}):([0-9]+)$/i);
                if (condition.startsWith("rumor_confidence_at_least:") &&
                    (!rumorConfidenceCondition || Number(rumorConfidenceCondition[2]) > 100)) {
                    errors.push("Dialogue " + id + "/" + nodeId + " has an invalid rumor confidence condition.");
                }
            }
            if (answer.condition?.startsWith("long_term_memory:")) {
                const tag = answer.condition.slice("long_term_memory:".length);
                if (!/^[a-z0-9_:-]{1,48}$/i.test(tag)) errors.push("Dialogue " + id + "/" + nodeId + " has an invalid long-term memory condition.");
                else longTermMemoryConditions.push({ dialogueId: id, nodeId, tag });
            }
            if (answer.condition?.startsWith("long_term_trust_") &&
                !/^long_term_trust_(at_least|below):[0-9]+([.][0-9]+)?$/.test(answer.condition)) {
                errors.push("Dialogue " + id + "/" + nodeId + " has an invalid long-term trust condition.");
            }
            if (answer.condition?.startsWith("familiarity_at_least:") &&
                !/^familiarity_at_least:[0-9]+([.][0-9]+)?$/.test(answer.condition)) {
                errors.push("Dialogue " + id + "/" + nodeId + " has an invalid familiarity condition.");
            }
            if (answer.condition?.startsWith("long_term_disposition:") &&
                !["unfamiliar", "warm", "open", "cautious", "guarded", "hostile"].includes(answer.condition.slice("long_term_disposition:".length))) {
                errors.push("Dialogue " + id + "/" + nodeId + " has an invalid long-term disposition condition.");
            }
            const goalProgressCondition = answer.condition?.match(/^npc_goal_progress_at_least:([a-z0-9_:-]{1,64}):([0-9]+)$/i);
            if (answer.condition?.startsWith("npc_goal_progress_at_least:") && !goalProgressCondition) {
                errors.push("Dialogue " + id + "/" + nodeId + " has an invalid NPC goal progress condition.");
            }
            if (goalProgressCondition) npcGoalConditions.push({ npcId: dialogue.npcId, goalId: goalProgressCondition[1], dialogueId: id, nodeId });
            if (answer.condition?.startsWith("npc_action_completed:")) {
                const ruleId = answer.condition.slice("npc_action_completed:".length);
                if (!/^[a-z0-9_:-]{1,64}$/i.test(ruleId)) {
                    errors.push("Dialogue " + id + "/" + nodeId + " has an invalid NPC action condition.");
                } else {
                    const exists = Object.values(data.cases).some(gameCase =>
                        (gameCase.npcs || []).includes(dialogue.npcId) &&
                        (gameCase.npcRelationships?.autonomousInteractions || []).some(rule =>
                            rule.id === ruleId && rule.fromNpcId === dialogue.npcId
                        )
                    );
                    if (!exists) errors.push("Dialogue " + id + "/" + nodeId + " references an NPC action not authored for " + dialogue.npcId + ": " + ruleId);
                }
            }
            if (answer.condition?.startsWith("npc_goal_completed:")) {
                const goalId = answer.condition.slice("npc_goal_completed:".length);
                if (!/^[a-z0-9_:-]{1,64}$/i.test(goalId)) errors.push("Dialogue " + id + "/" + nodeId + " has an invalid NPC goal completion condition.");
                else npcGoalConditions.push({ npcId: dialogue.npcId, goalId, dialogueId: id, nodeId });
            }
            if (answer.nextNode && !nodes[answer.nextNode]) {
                errors.push("Dialogue " + id + "/" + nodeId + " points to missing node: " + answer.nextNode);
            }
        }
    }
}

for (const condition of longTermMemoryConditions) {
    if (!authoredLongTermMemoryTags.has(condition.tag)) {
        errors.push("Dialogue " + condition.dialogueId + "/" + condition.nodeId +
            " checks long-term memory tag with no authored source: " + condition.tag);
    }
}

for (const condition of npcClaimConditions) {
    const key = condition.topic
        ? condition.npcId + ":" + condition.topic
        : condition.npcId + ":" + condition.claimId;
    const registry = condition.topic ? authoredNpcClaimTopics : authoredNpcClaims;
    if (!registry.has(key)) {
        errors.push("Dialogue " + condition.dialogueId + "/" + condition.nodeId +
            " checks an NPC claim with no authored source: " + key);
    }
}

for (const [id, gameCase] of Object.entries(data.cases)) {
    if (gameCase.id !== id) errors.push("Case key/id mismatch: " + id);
    if (!gameCase.startTime || !Number.isInteger(gameCase.startTime.hour) || gameCase.startTime.hour < 0 || gameCase.startTime.hour > 23 || !Number.isInteger(gameCase.startTime.minute) || gameCase.startTime.minute < 0 || gameCase.startTime.minute > 59) errors.push("Case has invalid start time: " + id);
    checkRef(data.locations, gameCase.startLocation, "Case " + id + " start location");
    for (const locationId of gameCase.locations || []) checkRef(data.locations, locationId, "Case " + id);
    for (const npcId of gameCase.npcs || []) checkRef(data.npcs, npcId, "Case " + id);
    const activeNpcIds = new Set(gameCase.npcs || []);
    const relationshipConfig = gameCase.npcRelationships || {};
    const goalIds = new Set();
    for (const goal of relationshipConfig.goals || []) {
        const key = goal?.npcId + ":" + goal?.id;
        if (!goal?.id || !/^[a-z0-9_:-]{1,64}$/i.test(goal.id) || goalIds.has(key)) {
            errors.push("Case " + id + " has a missing, invalid or duplicate NPC goal ID.");
        } else {
            goalIds.add(key);
            authoredNpcGoals.add(key);
        }
        if (!activeNpcIds.has(goal?.npcId)) errors.push("Case " + id + " NPC goal has an inactive owner: " + (goal?.id || "unknown"));
        if (!Number.isInteger(goal?.target) || goal.target < 1 || goal.target > 20) errors.push("Case " + id + " NPC goal has an invalid target: " + (goal?.id || "unknown"));
        if (goal?.priority !== undefined && (!Number.isFinite(goal.priority) || goal.priority < 0 || goal.priority > 100)) {
            errors.push("Case " + id + " NPC goal has an invalid priority: " + goal.id);
        }
        if (goal?.title !== undefined && (typeof goal.title !== "string" || goal.title.length > 100)) {
            errors.push("Case " + id + " NPC goal has an invalid title: " + goal.id);
        }
        if (goal?.description !== undefined && (typeof goal.description !== "string" || goal.description.length > 240)) {
            errors.push("Case " + id + " NPC goal has an invalid description: " + goal.id);
        }
    }
    const relationshipIds = new Set();
    for (const bond of relationshipConfig.bonds || []) {
        if (!bond?.id || relationshipIds.has(bond.id)) errors.push("Case " + id + " has a missing or duplicate NPC relationship ID.");
        else relationshipIds.add(bond.id);
        if (!activeNpcIds.has(bond?.fromNpcId) || !activeNpcIds.has(bond?.toNpcId) || bond.fromNpcId === bond.toNpcId) {
            errors.push("Case " + id + " has an NPC relationship with invalid participants: " + (bond?.id || "unknown"));
        }
        if (bond?.trust !== undefined && (!Number.isFinite(bond.trust) || bond.trust < 0 || bond.trust > 100)) {
            errors.push("Case " + id + " has invalid starting relationship trust: " + bond.id);
        }
    }
    const interactionIds = new Set();
    for (const rule of relationshipConfig.autonomousInteractions || []) {
        if (!rule?.id || interactionIds.has(rule.id)) errors.push("Case " + id + " has a missing or duplicate autonomous NPC interaction ID.");
        else interactionIds.add(rule.id);
        if (!relationshipIds.has(rule?.relationshipId)) errors.push("Case " + id + " NPC interaction references missing relationship: " + (rule?.id || "unknown"));
        if (!activeNpcIds.has(rule?.fromNpcId) || !activeNpcIds.has(rule?.toNpcId) || rule.fromNpcId === rule.toNpcId) {
            errors.push("Case " + id + " NPC interaction has invalid participants: " + (rule?.id || "unknown"));
        }
        if (!["support", "conflict", "reconcile", "avoidance"].includes(rule?.interaction)) {
            errors.push("Case " + id + " NPC interaction has invalid behavior: " + (rule?.id || "unknown"));
        }
        if (rule?.channel !== undefined && !["in_person", "phone", "message"].includes(rule.channel)) {
            errors.push("Case " + id + " NPC interaction has invalid channel: " + (rule?.id || "unknown"));
        }
        for (const field of ["fromCooperationDelta", "toCooperationDelta"]) {
            if (rule?.[field] !== undefined &&
                (!Number.isFinite(rule[field]) || rule[field] < -25 || rule[field] > 25)) {
                errors.push("Case " + id + " NPC interaction has invalid " + field + ": " + (rule?.id || "unknown"));
            }
        }
        if (rule?.goalId) {
            const owner = rule.goalNpcId || rule.fromNpcId;
            if (!activeNpcIds.has(owner) || !goalIds.has(owner + ":" + rule.goalId)) {
                errors.push("Case " + id + " NPC interaction references a missing personal goal: " + rule.id + "/" + rule.goalId);
            }
            if (rule.goalProgress !== undefined && (!Number.isFinite(rule.goalProgress) || rule.goalProgress < -10 || rule.goalProgress > 10)) {
                errors.push("Case " + id + " NPC interaction has invalid goal progress: " + rule.id);
            }
        }
        const conditions = rule?.conditions && typeof rule.conditions === "object" ? rule.conditions : rule;
        if (conditions?.fromRumorId !== undefined &&
            (typeof conditions.fromRumorId !== "string" || !/^[a-z0-9_:-]{1,100}$/i.test(conditions.fromRumorId))) {
            errors.push("Case " + id + " NPC interaction has invalid rumor ID: " + rule.id);
        }
        if (conditions?.fromRumorStatus !== undefined &&
            (!conditions.fromRumorId || !["unverified", "corroborated", "disputed"].includes(conditions.fromRumorStatus))) {
            errors.push("Case " + id + " NPC interaction has invalid rumor status condition: " + rule.id);
        }
        if (conditions?.fromRumorConfidenceAtLeast !== undefined &&
            (!conditions.fromRumorId || !Number.isFinite(conditions.fromRumorConfidenceAtLeast) ||
                conditions.fromRumorConfidenceAtLeast < 0 || conditions.fromRumorConfidenceAtLeast > 100)) {
            errors.push("Case " + id + " NPC interaction has invalid rumor confidence condition: " + rule.id);
        }
        if (conditions?.requiresGoalId) {
            const owner = conditions.requiresGoalNpcId || rule.fromNpcId;
            if (!goalIds.has(owner + ":" + conditions.requiresGoalId)) {
                errors.push("Case " + id + " NPC interaction condition references a missing personal goal: " + rule.id + "/" + conditions.requiresGoalId);
            }
            if (conditions.requiresGoalStatus !== undefined &&
                !["active", "completed", "abandoned"].includes(conditions.requiresGoalStatus)) {
                errors.push("Case " + id + " NPC interaction has an invalid required goal status: " + rule.id);
            }
            for (const field of ["requiresGoalProgressAtLeast", "requiresGoalProgressBelow"]) {
                if (conditions[field] !== undefined &&
                    (!Number.isInteger(conditions[field]) || conditions[field] < 0 || conditions[field] > 20)) {
                    errors.push("Case " + id + " NPC interaction has an invalid goal progress prerequisite: " + rule.id);
                }
            }
        }
    }
    for (const scene of gameCase.scenes || []) {
        checkRef(data.locations, scene.locationId, "Case scene " + (scene.id || id));
        for (const objectId of [...(scene.highlightObjects || []), ...(scene.nightOnlyObjects || [])]) {
            checkRef(data.objects, objectId, "Case scene " + (scene.id || id));
            acquirableItems.add(objectId);
        }
    }
    for (const condition of gameCase.unlockConditions || []) {
        checkRef(data.locations, condition.locationId, "Case unlock condition " + id);
        checkRef(data.objects, condition.requiresItem, "Case unlock condition " + id);
        const locationRequirement = data.locations[condition.locationId]?.requiresItem;
        if (locationRequirement && locationRequirement !== condition.requiresItem) errors.push("Case " + id + " unlock item disagrees with location " + condition.locationId + ": " + condition.requiresItem + " vs " + locationRequirement);
    }
    for (const event of gameCase.events || []) {
        if (event.trigger?.startsWith("item_acquired:")) checkRef(data.objects, event.trigger.slice(14), "Case event " + id + "/" + event.id);
        if (event.trigger?.startsWith("insight:")) insightSources.add(event.trigger.slice(8));
    }
    for (const stakeout of gameCase.stakeouts || []) {
        checkRef(data.locations, stakeout.locationId, "Stakeout " + stakeout.id);
        if (stakeout.reward?.type === "insight" && stakeout.reward.id) insightSources.add(stakeout.reward.id);
    }
    for (const chain of gameCase.evidenceChains || []) {
        for (const objectId of chain.requiredEvidence || []) {
            checkRef(data.objects, objectId, "Evidence chain " + chain.id);
            if (!acquirableItems.has(objectId)) errors.push("Evidence chain " + chain.id + " requires an item with no acquisition path: " + objectId);
        }
        for (const insightId of chain.requiredInsights || []) if (!insightSources.has(insightId)) errors.push("Evidence chain " + chain.id + " requires an insight with no source: " + insightId);
        if (chain.bonusInsight) insightSources.add(chain.bonusInsight);
    }
    if (gameCase.correctDeduction?.suspect && !(gameCase.npcs || []).includes(gameCase.correctDeduction.suspect)) {
        errors.push("Correct deduction suspect is not part of case " + id + ": " + gameCase.correctDeduction.suspect);
    }
}

for (const condition of npcGoalConditions) {
    if (!authoredNpcGoals.has(condition.npcId + ":" + condition.goalId)) {
        errors.push("Dialogue " + condition.dialogueId + "/" + condition.nodeId +
            " checks a personal goal that is not authored for NPC " + condition.npcId + ": " + condition.goalId);
    }
}

for (const [id, chain] of Object.entries(data.evidenceChains || {})) {
    if (chain.id !== id) errors.push("Evidence chain key/id mismatch: " + id);
    for (const objectId of chain.requiredEvidence || []) {
        checkRef(data.objects, objectId, "Registered evidence chain " + id);
        if (!acquirableItems.has(objectId)) errors.push("Registered evidence chain " + id + " requires an item with no acquisition path: " + objectId);
    }
    for (const insightId of chain.requiredInsights || []) if (!insightSources.has(insightId)) errors.push("Registered evidence chain " + id + " requires an insight with no source: " + insightId);
    if (chain.bonusInsight) insightSources.add(chain.bonusInsight);
}

for (const [id, gameCase] of Object.entries(data.cases)) {
    for (const event of gameCase.events || []) {
        if (event.trigger?.startsWith("insight:") && !insightSources.has(event.trigger.slice(8))) {
            errors.push("Case event " + id + "/" + event.id + " listens for an insight with no source: " + event.trigger.slice(8));
        }
    }
    for (const chain of gameCase.evidenceChains || []) {
        for (const insightId of chain.requiredInsights || []) {
            if (!insightSources.has(insightId)) errors.push("Evidence chain " + chain.id + " requires an insight with no source: " + insightId);
        }
    }
}

for (const [caseId] of Object.entries(data.cases)) {
    const caseEndings = Object.values(data.endings || {}).filter(ending => ending.caseId === caseId);
    if (!caseEndings.some(ending => ending.condition === "default")) errors.push("Case " + caseId + " has no default ending");
    if (!caseEndings.some(ending => ending.condition && ending.condition !== "default" && !ending.condition.startsWith("evidence_count_"))) errors.push("Case " + caseId + " has no confession-based ending");
    if (!Object.values(data.evidenceChains || {}).some(chain => chain.caseId === caseId)) errors.push("Case " + caseId + " has no registered evidence chains");
}

for (const [id, ending] of Object.entries(data.endings || {})) {
    if (ending.id !== id) errors.push("Ending key/id mismatch: " + id);
    if (ending.caseId && !data.cases[ending.caseId]) errors.push("Ending " + id + " references missing case: " + ending.caseId);
}

if (errors.length) {
    process.stderr.write("Game data validation failed (" + errors.length + " issue(s)):" + String.fromCharCode(10));
    for (const error of errors) process.stderr.write("- " + error + String.fromCharCode(10));
    process.exitCode = 1;
} else {
    process.stdout.write(
        "Game data validation passed: " + Object.keys(data.cases).length + " cases, " +
        Object.keys(data.locations).length + " locations, " +
        Object.keys(data.npcs).length + " NPCs, " +
        Object.keys(data.objects).length + " objects, " +
        Object.keys(data.dialogues).length + " dialogues." + String.fromCharCode(10)
    );
}
