/**
 * AchievementSystem
 * Data-driven achievements with save/cloud persistence. Case packs can declare
 * their own achievements on CASE_XXX.achievements without changing this module.
 */
class AchievementSystem {
    constructor(progress = null, eventBus = typeof events !== 'undefined' ? events : null, services = {}) {
        this.progress = progress;
        this.events = eventBus;
        this.services = services || {};
        this.achievements = [];
        this.caseDefinitions = new Map();
        this.unlocked = [];
        this.records = {};
        this._defineAchievements();
        this.registerCases(typeof CASES_INDEX !== 'undefined' ? Object.values(CASES_INDEX) : []);
        this._bindGameplayEvents();
    }

    _defineAchievements() {
        this.achievements = [
            {
                id: 'first_case', name: 'Первое дело', description: 'Раскройте первое дело',
                icon: '🔍', rarity: 'common', criteria: { type: 'solved_cases', count: 1 }
            },
            {
                id: 'three_cases', name: 'Опытный сыщик', description: 'Раскройте три разных дела',
                icon: '⭐', rarity: 'rare', criteria: { type: 'solved_cases', count: 3 }
            },
            {
                id: 'no_hints', name: 'Без подсказок', description: 'Раскройте дело, не воспользовавшись подсказками',
                icon: '🧠', rarity: 'rare', criteria: { type: 'no_hints' }
            },
            {
                id: 'perfect_case', name: 'Идеальное расследование', description: 'Раскройте дело с первой попытки ответа',
                icon: '🎯', rarity: 'epic', criteria: { type: 'first_attempt' }
            },
            {
                id: 'first_ending', name: 'Последняя страница', description: 'Получите свою первую концовку',
                icon: '📖', rarity: 'common', criteria: { type: 'ending' }
            },
            {
                id: 'all_evidence', name: 'Коллекционер улик', description: 'Соберите все улики одного расследования',
                icon: '📦', rarity: 'common', criteria: { type: 'all_case_evidence' }
            },
            {
                id: 'night_owl', name: 'Полуночник', description: 'Проведите расследование глубокой ночью',
                icon: '🦉', rarity: 'common', criteria: { type: 'night_time', startHour: 0, endHour: 5 }
            },
            {
                id: 'social_detective', name: 'Душа компании', description: 'Поговорите со всеми свидетелями дела',
                icon: '💬', rarity: 'uncommon', criteria: { type: 'manual' }
            },
            {
                id: 'speedy', name: 'Быстрый детектив', description: 'Раскройте дело менее чем за 30 игровых минут',
                icon: '⚡', rarity: 'epic', criteria: { type: 'under_game_minutes', minutes: 30 }
            },
            {
                id: 'board_master', name: 'Мастер доски', description: 'Заполните все слоты на доске расследования',
                icon: '📋', rarity: 'uncommon', criteria: { type: 'board_full' }
            },
            {
                id: 'two_endings', name: 'Две стороны правды', description: 'Откройте две разные концовки',
                icon: '⚖️', rarity: 'epic', criteria: { type: 'unique_endings', count: 2 }
            },
            {
                id: 'legend', name: 'Легенда участка', description: 'Достигните репутации 90',
                icon: '👑', rarity: 'legendary', criteria: { type: 'reputation', value: 90 }
            }
        ];
    }

    _bindGameplayEvents() {
        if (!this.events?.on) return;
        this._eventUnsubscribers = [
            this.events.on('case:started', data => {
                const caseId = data?.caseId || data?.caseData?.id;
                if (!caseId) return;
                this.progress.activeCase = caseId;
                const time = this.services.gameTime?.toJSON?.() || this.progress.gameTime || data.caseData?.startTime;
                const absolute = this._absoluteGameMinute(time);
                this.progress.activeRunStartedGameMinute = absolute;
                this._syncProgress();
            }),
            this.events.on('inventory:changed', data => {
                if (data?.action !== 'add' || !this.progress?.activeCase) return;
                this._checkAllCaseEvidence(this.progress.activeCase);
            }),
            this.events.on('case:solved', data => {
                const caseId = data?.caseId || data?.caseData?.id || this.progress?.activeCase;
                const storedStart = this.progress?.activeRunStartedGameMinute;
                const hasStart = typeof storedStart === 'number' && Number.isFinite(storedStart);
                const start = hasStart ? storedStart : null;
                const current = this._absoluteGameMinute(
                    this.services.gameTime?.toJSON?.() || this.progress?.gameTime
                );
                if (caseId && hasStart && Number.isFinite(current)) {
                    const elapsed = current - start;
                    if (elapsed >= 0 && elapsed < 30) {
                        this.unlock('speedy', {
                            caseData: { id: caseId },
                            context: 'fast_investigation',
                            elapsedGameMinutes: elapsed
                        });
                    }
                }
                if (this.progress) this.progress.activeRunStartedGameMinute = null;
            }),
            this.events.on('time:changed', data => {
                if (!this.progress?.activeCase) return;
                const hour = Number(data?.hour);
                if (Number.isInteger(hour) && hour >= 0 && hour < 5) {
                    this.unlock('night_owl', {
                        caseData: { id: this.progress.activeCase },
                        context: 'night_investigation',
                        hour
                    });
                }
            }),
            this.events.on('board:updated', data => {
                if (data?.action !== 'place' || !this.progress?.activeCase) return;
                if (Number(data.filledSlots) >= Number(data.totalSlots) && Number(data.totalSlots) > 0) {
                    this.unlock('board_master', {
                        caseData: { id: data.caseId || this.progress.activeCase },
                        context: 'completed_investigation_board'
                    });
                }
            })
        ].filter(Boolean);
    }

    reconcile() {
        const caseId = this.progress?.activeCase;
        if (!caseId) return [];
        const unlocked = [];
        const time = this.services.gameTime?.toJSON?.() || this.progress.gameTime;
        const hour = Number(time?.hour);
        if (Number.isInteger(hour) && hour >= 0 && hour < 5) {
            const record = this.unlock('night_owl', {
                caseData: { id: caseId }, context: 'resumed_night_investigation', hour
            });
            if (record) unlocked.push(record);
        }
        const evidence = this._checkAllCaseEvidence(caseId);
        if (evidence) unlocked.push(this.records.all_evidence);
        return unlocked;
    }

    _absoluteGameMinute(time) {
        if (!time || !Number.isFinite(Number(time.hour)) || !Number.isFinite(Number(time.minute))) return null;
        const day = Number.isFinite(Number(time.day)) ? Math.max(1, Number(time.day)) : 1;
        return (day - 1) * 1440 + Number(time.hour) * 60 + Number(time.minute);
    }

    _checkAllCaseEvidence(caseId) {
        const caseData = this.caseDefinitions.get(caseId);
        const required = caseData?.evidenceIds;
        const items = this.services.inventory?.items;
        if (!Array.isArray(required) || required.length === 0 || !Array.isArray(items)) return false;
        if (!required.every(id => items.includes(id))) return false;
        return Boolean(this.unlock('all_evidence', {
            caseData: { id: caseId },
            context: 'all_case_evidence_collected',
            evidenceCount: required.length
        }));
    }

    dispose() {
        for (const unsubscribe of this._eventUnsubscribers || []) {
            if (typeof unsubscribe === 'function') unsubscribe();
        }
        this._eventUnsubscribers = [];
    }

    registerCases(cases = []) {
        for (const caseData of cases) {
            if (caseData?.id) this.caseDefinitions.set(caseData.id, caseData);
            for (const definition of caseData?.achievements || []) {
                this.register({
                    ...definition,
                    caseId: definition.caseId || caseData.id,
                    source: 'case'
                });
            }
        }
    }

    register(definition) {
        if (!definition || typeof definition.id !== 'string' || !definition.id.trim() ||
            !definition.criteria || typeof definition.criteria.type !== 'string') return false;
        const normalized = {
            name: 'Секретное достижение',
            description: 'Особое условие расследования выполнено.',
            icon: '◆',
            rarity: 'common',
            ...definition
        };
        const index = this.achievements.findIndex(item => item.id === normalized.id);
        if (index >= 0) this.achievements[index] = normalized;
        else this.achievements.push(normalized);
        return true;
    }

    load(saved = null, legacyUnlocked = []) {
        const source = saved && typeof saved === 'object' ? saved : {};
        const savedIds = Array.isArray(source.unlocked) ? source.unlocked : [];
        const legacyIds = Array.isArray(legacyUnlocked) ? legacyUnlocked : [];
        const records = Array.isArray(source.records) ? source.records : [];
        this.records = {};
        for (const record of records) {
            if (record?.id && typeof record.id === 'string') this.records[record.id] = { ...record };
        }
        this.unlocked = [...new Set([...savedIds, ...legacyIds, ...Object.keys(this.records)])]
            .filter(id => typeof id === 'string');
        for (const id of this.unlocked) {
            if (!this.records[id]) this.records[id] = {
                id, unlockedAt: null, caseId: null, runId: null, migrated: true
            };
        }
        this._syncProgress();
        return this.unlocked.length;
    }

    checkAll(context = {}) {
        const progress = this.progress || {};
        const solvedCases = Array.isArray(progress.solvedCases) ? progress.solvedCases : [];
        const history = progress.trackerData?.stats?.casesHistory || [];
        const endings = new Set(history.filter(item => item.result === 'solved' && item.endingId).map(item => item.endingId));
        const reputation = Number(progress.reputationData?.reputation ??
            (typeof window !== 'undefined' ? window.app?.reputationSystem?.getReputation?.() : 0)) || 0;
        const run = context.runRecord || null;
        const newlyUnlocked = [];

        for (const achievement of this.achievements) {
            if (this.unlocked.includes(achievement.id)) continue;
            if (!this._matches(achievement, { ...context, runRecord: run, solvedCases, endings, reputation })) continue;
            const record = this._unlock(achievement, context);
            if (record) newlyUnlocked.push(record);
        }
        this._syncProgress();
        return newlyUnlocked;
    }

    _matches(achievement, context) {
        const rule = achievement.criteria || {};
        const run = context.runRecord;
        if (achievement.caseId && context.caseData?.id !== achievement.caseId) return false;
        switch (rule.type) {
            case 'solved_cases': return context.solvedCases.length >= (Number(rule.count) || 1);
            case 'no_hints': return context.caseData?.id && run?.result === 'solved' && Number(run.hintsUsed) === 0;
            case 'first_attempt': return context.caseData?.id && run?.result === 'solved' && Number(run.attempts) <= 1;
            case 'ending': return Boolean(run?.endingId || context.ending?.id);
            case 'unique_endings': return context.endings.size >= (Number(rule.count) || 1);
            case 'reputation': return context.reputation >= (Number(rule.value) || 90);
            case 'case_solved': return context.caseData?.id === (rule.caseId || achievement.caseId) && run?.result === 'solved';
            case 'ending_id': return run?.result === 'solved' && (run.endingId || context.ending?.id) === rule.endingId;
            case 'case_no_hints': return context.caseData?.id === (rule.caseId || achievement.caseId) &&
                run?.result === 'solved' && Number(run.hintsUsed) === 0;
            case 'case_first_attempt': return context.caseData?.id === (rule.caseId || achievement.caseId) &&
                run?.result === 'solved' && Number(run.attempts) <= 1;
            default: return false;
        }
    }

    unlock(achievementId, context = {}) {
        const achievement = this.achievements.find(item => item.id === achievementId);
        if (!achievement || this.unlocked.includes(achievementId)) return false;
        return this._unlock(achievement, context);
    }

    _unlock(achievement, context = {}) {
        if (this.unlocked.includes(achievement.id)) return null;
        this.unlocked.push(achievement.id);
        const record = {
            id: achievement.id,
            unlockedAt: new Date().toISOString(),
            caseId: context.caseData?.id || null,
            runId: context.runRecord?.runId || null
        };
        this.records[achievement.id] = record;
        this._syncProgress();
        this.events?.emit('notification:show', {
            message: `🏆 Достижение: ${achievement.icon} ${achievement.name} — ${achievement.description}`,
            type: 'success',
            duration: 5000
        });
        this.events?.emit('achievement:unlocked', { ...record, achievement });
        if (typeof storage !== 'undefined') storage.set('achievements', this.unlocked);
        return record;
    }

    _syncProgress() {
        if (this.progress) this.progress.achievementData = this.toJSON();
    }

    getUnlocked() {
        return this.achievements.filter(item => this.unlocked.includes(item.id));
    }

    getAll() {
        return this.achievements.map(item => ({
            ...item,
            unlocked: this.unlocked.includes(item.id),
            unlockedAt: this.records[item.id]?.unlockedAt || null
        }));
    }

    getSummary() {
        const unlocked = this.achievements.filter(item => this.unlocked.includes(item.id)).length;
        return { total: this.achievements.length, unlocked,
            percent: this.achievements.length ? Math.round(unlocked / this.achievements.length * 100) : 0 };
    }

    toJSON() {
        return {
            version: 1,
            unlocked: [...this.unlocked],
            records: Object.values(this.records).map(record => ({ ...record }))
        };
    }
}
