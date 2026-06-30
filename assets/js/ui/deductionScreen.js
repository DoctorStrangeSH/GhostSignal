class DeductionScreen {
    constructor() {
        this._bindEvents();
    }

    _bindEvents() {
        // Заменяем стандартный финальный ответ на дедуктивную цепочку
        events.on('case:ready_for_final', (ready) => {
            if (ready) {
                const finalArea = document.getElementById('final-answer-area');
                if (finalArea) {
                    finalArea.classList.remove('hidden');
                    finalArea.querySelector('.btn-final').textContent = '🔍 ДЕДУКЦИЯ';
                }
            }
        });
    }

    show(caseData) {
        if (!caseData?.finalQuestion) return;

        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        const modalFooter = document.getElementById('modal-footer');
        if (!modalBody || !modalTitle || !modalFooter) return;

        modalTitle.textContent = '🧩 ДЕДУКЦИЯ';

        const question = caseData.finalQuestion;

        modalBody.innerHTML = `
            <div class="deduction-screen">
                <p class="deduction-question">${question.text}</p>

                <div class="deduction-row">
                    <label>Подозреваемый:</label>
                    <select id="ded-suspect" class="terminal-input">
                        <option value="">-- Выберите --</option>
                        ${(caseData.deductionSuspects || this._getDefaultSuspects(caseData)).map(s =>
                            `<option value="${s.id}">${s.icon} ${s.name}</option>`
                        ).join('')}
                    </select>
                </div>

                <div class="deduction-row">
                    <label>Мотив:</label>
                    <select id="ded-motive" class="terminal-input">
                        <option value="">-- Выберите --</option>
                        ${(caseData.deductionMotives || [
                            { id: 'revenge', name: '💔 Месть' },
                            { id: 'money', name: '💰 Деньги' },
                            { id: 'love', name: '💘 Любовь/Ревность' },
                            { id: 'fear', name: '😱 Страх' },
                            { id: 'accident', name: '🍀 Случайность' }
                        ]).map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                    </select>
                </div>

                <div class="deduction-row">
                    <label>Орудие:</label>
                    <select id="ded-weapon" class="terminal-input">
                        <option value="">-- Выберите --</option>
                        ${(caseData.deductionWeapons || [
                            { id: 'poison', name: '🧪 Яд' },
                            { id: 'sedative', name: '💊 Снотворное' },
                            { id: 'strangle', name: '🧣 Удушение' },
                            { id: 'push', name: '🚶 Толчок' }
                        ]).map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    </select>
                </div>

                <div id="deduction-feedback" class="hidden" style="margin-top: 16px;"></div>
            </div>
        `;

        modalFooter.innerHTML = `
            <button id="btn-deduction-submit" class="terminal-btn">🔍 ПРЕДЪЯВИТЬ</button>
            <button class="terminal-btn" data-bs-dismiss="modal">ОТМЕНА</button>
        `;

        const modal = new bootstrap.Modal(document.getElementById('universal-modal'));
        modal.show();

        document.getElementById('btn-deduction-submit')?.addEventListener('click', () => {
            const suspect = document.getElementById('ded-suspect')?.value;
            const motive = document.getElementById('ded-motive')?.value;
            const weapon = document.getElementById('ded-weapon')?.value;

            if (!suspect || !motive || !weapon) {
                events.emit('notification:show', {
                    message: 'Выберите все три пункта',
                    type: 'warning',
                    duration: 2000
                });
                return;
            }

            const result = this._checkDeduction(caseData, suspect, motive, weapon);
            this._showDeductionResult(result, modal, caseData);
        });
    }

    _getDefaultSuspects(caseData) {
        if (!caseData?.npcs) return [];
        return caseData.npcs.map(id => {
            const npc = getNPCById(id);
            return npc ? { id: npc.id, name: npc.name, icon: npc.icon } : null;
        }).filter(Boolean);
    }

    _checkDeduction(caseData, suspect, motive, weapon) {
        const correct = caseData.correctDeduction || {
            suspect: caseData.finalQuestion.correctAnswer,
            motive: 'love',
            weapon: 'sedative'
        };

        const suspectCorrect = suspect === correct.suspect || 
            caseData.finalQuestion.acceptableAnswers.includes(suspect);
        const motiveCorrect = motive === correct.motive;
        const weaponCorrect = weapon === correct.weapon;

        const allCorrect = suspectCorrect && motiveCorrect && weaponCorrect;

        return {
            allCorrect,
            suspectCorrect,
            motiveCorrect,
            weaponCorrect,
            correct
        };
    }

    _showDeductionResult(result, modal, caseData) {
        const feedback = document.getElementById('deduction-feedback');
        if (!feedback) return;

        feedback.classList.remove('hidden');

        if (result.allCorrect) {
            feedback.innerHTML = `
                <div class="feedback feedback-success">
                    <h4>✅ ВСЁ ВЕРНО!</h4>
                    <p>Подозреваемый: ✅</p>
                    <p>Мотив: ✅</p>
                    <p>Орудие: ✅</p>
                    <p style="margin-top: 8px;">${caseData.finalQuestion.feedbackCorrect.text}</p>
                </div>
            `;
            document.getElementById('btn-deduction-submit').disabled = true;
            setTimeout(() => {
                modal.hide();
                events.emit('case:solved', { caseId: caseData.id, ...caseData });
            }, 3000);
        } else {
            feedback.innerHTML = `
                <div class="feedback feedback-error">
                    <h4>❌ НЕ ВСЁ ВЕРНО</h4>
                    <p>Подозреваемый: ${result.suspectCorrect ? '✅' : '❌'}</p>
                    <p>Мотив: ${result.motiveCorrect ? '✅' : '❌'}</p>
                    <p>Орудие: ${result.weaponCorrect ? '✅' : '❌'}</p>
                    <p style="margin-top: 8px;">Подумайте ещё. У вас есть все улики.</p>
                </div>
            `;
        }
    }
}