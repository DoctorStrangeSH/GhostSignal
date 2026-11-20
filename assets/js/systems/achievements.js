/**
 * AchievementSystem
 * Data-driven achievements with save/cloud persistence. Case packs can declare
 * their own achievements on CASE_XXX.achievements without changing this module.
 */
class AchievementSystem {
    constructor(progress = null, eventBus = typeof events !== 'undefined' ? events : null) {
        this.progress = progress;
        this.events = eventBus;
        this.achievements = [];
        this.unlocked = [];
        this.records = {};
        this._defineAchievements();
        this.registerCases(typeof CASES_INDEX !== 'undefined' ? Object.values(CASES_INDEX) : []);
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
                id: 'two_endings', name: 'Две стороны правды', description: 'Откройте две разные концовки',
                icon: '⚖️', rarity: 'epic', criteria: { type: 'unique_endings', count: 2 }
            },
            {
                id: 'legend', name: 'Легенда участка', description: 'Достигните репутации 90',
                icon: '👑', rarity: 'legendary', criteria: { type: 'reputation', value: 90 }
            }
        ];
    }

    registerCases(cases = []) {
        for (const caseData of cases) {
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
        return { total: this.achievements.length, unlocked: this.unlocked.length,
            percent: this.achievements.length ? Math.round(this.unlocked.length / this.achievements.length * 100) : 0 };
    }

    toJSON() {
        return {
            version: 1,
            unlocked: [...this.unlocked],
            records: Object.values(this.records).map(record => ({ ...record }))
        };
    }
}
