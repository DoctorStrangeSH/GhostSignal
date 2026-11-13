/**
 * NavigationController
 * Owns screen navigation, navigation controls and keyboard shortcuts.
 * App remains the composition root and is passed in as a dependency.
 */
class NavigationController {
    constructor(app) {
        this.app = app;
    }

    bindNavigation() {
        const app = this.app;
        document.getElementById('btn-open-cases')?.addEventListener('click', () => {
            app.navigateTo('screen-cases');
            app.caseListUI?.render();
        });
        document.getElementById('btn-continue')?.addEventListener('click', () => {
            if (app.progress.activeCase) app.loadCase(app.progress.activeCase);
        });
        document.getElementById('btn-stats')?.addEventListener('click', () => {
            app.statsScreen.setTracker(app.progressTracker);
            app.statsScreen.render();
            app.navigateTo('screen-stats');
        });
        document.getElementById('btn-options')?.addEventListener('click', () => app._showOptionsMenu());
        document.querySelectorAll('.btn-back').forEach(button => {
            button.addEventListener('click', () => {
                const target = button.dataset.screen;
                if (target) app.navigateTo(target);
            });
        });
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const id = tab.dataset.tab;
                app._switchTab(id);
                events.emit('tab:switched', id);
            });
        });
        document.getElementById('btn-map')?.addEventListener('click', () => {
            app.navigateTo('screen-map');
            app.mapRenderer?.render();
        });
        document.getElementById('btn-wait')?.addEventListener('click', () => app._showWaitDialog());
        document.getElementById('btn-hint')?.addEventListener('click', () => {
            const question = app.caseManager?.currentCase?.finalQuestion;
            if (!question) return;

            events.emit('modal:show', {
                title: '💡 ПОДСКАЗКА',
                body: `<p>${question.hint}</p>`,
                footer: '<button class="terminal-btn" data-bs-dismiss="modal">ПОНЯТНО</button>'
            });
            app.reputationSystem?.usedHint();
            app.progressTracker?.useHint();
            app.progress.trackerData = app.progressTracker?.toJSON();
            storage.saveProgress(app.progress);
        });
        document.getElementById('btn-final-answer')?.addEventListener('click', () => {
            if (app.caseManager?.currentCase) app.deductionScreen.show(app.caseManager.currentCase);
        });
    }

    bindKeyboard() {
        const app = this.app;
        document.addEventListener('keydown', event => {
            if (app.currentScreen !== 'screen-main-menu') return;
            if (event.key === '1') document.getElementById('btn-open-cases')?.click();
            if (event.key === '2') {
                const button = document.getElementById('btn-continue');
                if (button && !button.classList.contains('hidden')) button.click();
            }
            if (event.key === '3') document.getElementById('btn-stats')?.click();
            if (event.key === '4') document.getElementById('btn-options')?.click();
        });
    }

    bindGlobalShortcuts() {
        const app = this.app;
        document.addEventListener('keydown', event => {
            if (event.ctrlKey && event.key === 's') {
                event.preventDefault();
                app._quickSave();
                return;
            }
            if (event.key === 'Escape' && !event.ctrlKey) {
                const modal = document.querySelector('.modal.show');
                if (modal) {
                    bootstrap.Modal.getInstance(modal)?.hide();
                    return;
                }
                if (app.currentScreen !== 'screen-main-menu') {
                    app.navigateTo('screen-main-menu');
                    return;
                }
            }
            if (event.key === 'm' && !event.ctrlKey && app.currentScreen === 'screen-case-active') {
                event.preventDefault();
                app.navigateTo('screen-map');
                app.mapRenderer?.render();
            }
            if (event.key === 'i' && !event.ctrlKey && app.currentScreen === 'screen-case-active') {
                event.preventDefault();
                app._switchTab('tab-inventory');
            }
            if (event.key === 'n' && !event.ctrlKey && app.currentScreen === 'screen-case-active') {
                event.preventDefault();
                app._switchTab('tab-notes');
            }
            if (event.key === 't' && !event.ctrlKey && app.currentScreen === 'screen-case-active') {
                event.preventDefault();
                app._showWaitDialog();
            }
        });
    }

    navigateTo(screenId) {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            this.app.currentScreen = screenId;
        }
    }

    switchTab(tabId) {
        document.querySelectorAll('.sidebar-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        const tab = document.querySelector(`[data-tab="${tabId}"]`);
        const panel = document.getElementById(tabId);
        if (tab) tab.classList.add('active');
        if (panel) panel.classList.add('active');
        if (tabId === 'tab-board') this.app.boardUI?.render();
    }
}
