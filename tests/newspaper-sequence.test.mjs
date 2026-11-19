import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createHarness() {
    const listeners = new Map();
    const emitted = [];
    const timers = new Map();
    let nextTimer = 0;
    const modal = new EventTarget();
    const context = vm.createContext({
        events: {
            on(name, fn) {
                if (!listeners.has(name)) listeners.set(name, []);
                listeners.get(name).push(fn);
            },
            emit(name, data) {
                emitted.push({ name, data });
                for (const fn of listeners.get(name) || []) fn(data);
            }
        },
        document: { getElementById: id => id === 'universal-modal' ? modal : null },
        getNewspaper: id => ({ title: id, date: '1947', headline: 'Газета', subtitle: '', content: '' }),
        setTimeout(fn, delay) { timers.set(++nextTimer, { fn, delay }); return nextTimer; },
        clearTimeout(id) { timers.delete(id); }
    });
    const source = readFileSync(resolve(root, 'assets/js/ui/newspaperUI.js'), 'utf8');
    vm.runInContext(source + '\nnew NewspaperUI();', context);
    return {
        emit: context.events.emit,
        modal,
        emitted,
        timers,
        flush() {
            const pending = [...timers.entries()];
            timers.clear();
            for (const [, task] of pending) task.fn();
        }
    };
}

test('solved-case newspaper waits for the ending report to be closed', () => {
    const h = createHarness();
    h.emit('case:solved', { caseId: 'case-002' });
    h.emit('ending:determined', { caseId: 'case-002', ending: { title: 'Итог' } });
    assert.equal(h.timers.size, 0, 'automatic newspaper timer must be cancelled');
    h.modal.dispatchEvent(new Event('shown.bs.modal'));
    h.flush();
    assert.equal(h.emitted.filter(e => e.name === 'modal:show').length, 0);

    h.modal.dispatchEvent(new Event('hidden.bs.modal'));
    h.flush();
    const papers = h.emitted.filter(e => e.name === 'modal:show');
    assert.equal(papers.length, 1);
    assert.match(papers[0].data.title, /case-002-solved/);
});

test('solved case without a report still shows the newspaper', () => {
    const h = createHarness();
    h.emit('case:solved', { caseId: 'case-001' });
    h.flush();
    h.flush();
    const papers = h.emitted.filter(e => e.name === 'modal:show');
    assert.equal(papers.length, 1);
    assert.match(papers[0].data.title, /case-001-solved/);
});

test('failed cases retain their existing delayed newspaper', () => {
    const h = createHarness();
    h.emit('case:failed', { caseId: 'case-002' });
    assert.equal([...h.timers.values()][0].delay, 2000);
    h.flush();
    assert.equal(h.emitted.filter(e => e.name === 'modal:show').length, 1);
});
