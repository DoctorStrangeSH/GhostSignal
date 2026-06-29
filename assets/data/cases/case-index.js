const CASES_INDEX = {
    "case-001": CASE_001,
    "case-002": CASE_002,
};

// Получить дело по ID
function getCaseById(caseId) {
    return CASES_INDEX[caseId] || null;
}

// Получить список всех дел
function getAllCases() {
    return Object.values(CASES_INDEX).map(c => ({
        id: c.id,
        title: c.title,
        difficulty: c.difficulty,
        description: c.description,
        isAvailable: true  // В будущем: проверка условий
    }));
}