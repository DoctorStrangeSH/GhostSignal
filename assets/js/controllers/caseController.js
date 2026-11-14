/**
 * CaseController
 * Coordinates the app-facing lifecycle of selecting, starting and resuming a case.
 * CaseManager remains the owner of case rules and per-case progress.
 */
class CaseController {
    constructor(app, caseLookup = getCaseById) {
        this.app = app;
        this.caseLookup = caseLookup;
    }

    canResume(caseId = this.app.progress?.activeCase) {
        const app = this.app;
        return Boolean(caseId && app.progress?.activeCase === caseId &&
            app.caseManager?.currentCase?.id === caseId &&
            app.caseManager.caseState === 'active');
    }

    loadCase(caseId) {
        const app = this.app;
        if (!caseId || !app.progress || !app.caseManager) return false;

        const caseData = this.caseLookup(caseId);
        if (!caseData) {
            console.warn('Cannot open unknown case:', caseId);
            return false;
        }

        const canResume = this.canResume(caseId);

        if (!canResume && !app.caseManager.loadCase(caseId)) return false;

        app.navigateTo('screen-case-active');

        const locationId = app.locationManager?.currentLocation || caseData.startLocation || 'police_station';
        app.sceneRenderer?.renderLocation(locationId);

        const caseNumber = document.getElementById('header-case-id');
        const caseTitle = document.getElementById('header-case-title');
        if (caseNumber) caseNumber.textContent = caseId.replace('case-', '');
        if (caseTitle) caseTitle.textContent = caseData.title || '';

        app.progress.activeCase = caseId;
        // Persist the complete case snapshot immediately: selecting/continuing
        // a case must not depend on the next timed autosave.
        app._quickSave();
        return true;
    }
}
