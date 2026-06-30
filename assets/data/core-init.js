// ============================================
// ЯДРО ДАННЫХ — ИНИЦИАЛИЗАЦИЯ
// Загружается ПЕРВЫМ перед всеми модулями
// ============================================

window.LOCATIONS_INDEX = {};
window.NPCS_INDEX = {};
window.OBJECTS_INDEX = {};
window.DIALOGUES_INDEX = {};
window.EVIDENCE_CHAINS = {};
window.ENDINGS = {};

// === ФУНКЦИИ ДОСТУПА ===

function getLocationById(id) {
    return window.LOCATIONS_INDEX[id] || null;
}

function getMapLocations() {
    return Object.values(window.LOCATIONS_INDEX).filter(loc => loc.mapPosition !== null);
}

function getSubLocations(parentId) {
    return Object.values(window.LOCATIONS_INDEX).filter(loc => loc.parentLocation === parentId);
}

function getNPCById(id) {
    return window.NPCS_INDEX[id] || null;
}

function getNPCsByLocation(locationId) {
    return Object.values(window.NPCS_INDEX).filter(npc => {
        return npc.schedule?.locations?.work === locationId ||
               npc.schedule?.locations?.home === locationId;
    });
}

function getNPCsByCase(caseData) {
    if (!caseData?.npcs || !Array.isArray(caseData.npcs)) return [];
    return caseData.npcs.map(id => getNPCById(id)).filter(Boolean);
}

function getObjectById(id) {
    return window.OBJECTS_INDEX[id] || null;
}

function getObjectsByIds(ids) {
    if (!ids || !Array.isArray(ids)) return [];
    return ids.map(id => getObjectById(id)).filter(Boolean);
}

function getEvidenceItems() {
    return Object.values(window.OBJECTS_INDEX).filter(obj => obj.isEvidence);
}

function getTakeableItems() {
    return Object.values(window.OBJECTS_INDEX).filter(obj => obj.takeable);
}

function getDialogueById(id) {
    return window.DIALOGUES_INDEX[id] || null;
}

function getDialogueForNPC(npcId, condition) {
    const npc = getNPCById(npcId);
    if (npc?.specialConditions) {
        for (const cond of npc.specialConditions) {
            if (cond.condition === condition && cond.dialogueId) {
                return getDialogueById(cond.dialogueId);
            }
        }
    }
    const dialogueId = npc?.dialogueId;
    return dialogueId ? getDialogueById(dialogueId) : null;
}

// === РЕГИСТРАЦИЯ ДАННЫХ ===
// Модули вызывают эту функцию чтобы добавить себя в реестры

function registerData(type, data) {
    const registries = {
        location: window.LOCATIONS_INDEX,
        npc: window.NPCS_INDEX,
        object: window.OBJECTS_INDEX,
        dialogue: window.DIALOGUES_INDEX,
        evidence: window.EVIDENCE_CHAINS,
        ending: window.ENDINGS
    };
    
    const registry = registries[type];
    if (!registry) {
        console.warn('Неизвестный тип данных:', type);
        return;
    }
    
    if (type === 'dialogue' && data.id) {
        registry[data.id] = data;
        console.log('💬 Диалог:', data.id);
    } else if (typeof data === 'object') {
        Object.assign(registry, data);
        console.log('📦 ' + type + ':', Object.keys(data).length, 'шт.');
    }
}

// === БАЗОВЫЕ ЛОКАЦИИ (всегда доступны) ===
registerData('location', {
    police_station: {
        id: "police_station",
        name: "Полицейский участок",
        type: "public",
        description: "Ваш опорный пункт. Терминал, архив, доска расследований.",
        hours: { open: 0, close: 24 },
        icon: "🏢",
        mapPosition: { x: 50, y: 60 },
        scenes: { day: null, night: null },
        npcsPresent: ["sergeant"],
        defaultItems: [],
        unlockedByDefault: true
    }
});

console.log('🧬 Ядро данных готово');