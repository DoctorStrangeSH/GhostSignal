import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createInspectionHarness() {
    const emitted = [];
    const insights = [];
    const context = vm.createContext({
        events: {
            emit(name, payload) { emitted.push({ name, payload }); }
        },
        document: {}
    });
    const source = readFileSync(resolve(root, "assets/js/ui/inventoryUI.js"), "utf8");
    vm.runInContext(source, context, { filename: "assets/js/ui/inventoryUI.js" });

    const inspect = vm.runInContext("InventoryUI.prototype._showItemDetails", context);
    const inventory = {
        addInsight(id) {
            if (!insights.includes(id)) insights.push(id);
        }
    };
    return {
        emitted,
        insights,
        inspect(item) {
            inspect.call({
                inventory,
                _evidenceKind: () => "Документ"
            }, item);
        }
    };
}

test("inspecting an evidence item in the inventory grants its authored insight", () => {
    const harness = createInspectionHarness();
    harness.inspect({
        id: "victim_diary",
        name: "Дневник жертвы",
        icon: "📔",
        isEvidence: true,
        interactions: {
            examine: {
                text: "Последняя запись указывает на опасность.",
                timeCost: 10,
                givesInsight: "victim_knew_danger"
            }
        }
    });

    assert.deepEqual(harness.insights, ["victim_knew_danger"]);
    assert.equal(harness.emitted.filter(event => event.name === "modal:show").length, 1);
    assert.deepEqual(
        harness.emitted.filter(event => event.name === "time:advance").map(event => event.payload),
        [10]
    );
});

test("repeated inspection does not duplicate an already-known insight", () => {
    const harness = createInspectionHarness();
    const diary = {
        id: "victim_diary",
        name: "Дневник жертвы",
        icon: "📔",
        isEvidence: true,
        interactions: { examine: { text: "Запись.", givesInsight: "victim_knew_danger" } }
    };

    harness.inspect(diary);
    harness.inspect(diary);

    assert.deepEqual(harness.insights, ["victim_knew_danger"]);
    assert.equal(harness.emitted.filter(event => event.name === "modal:show").length, 2);
});

test("items without an authored insight remain inspectable without inventing one", () => {
    const harness = createInspectionHarness();
    harness.inspect({
        id: "small_key",
        name: "Маленький ключ",
        icon: "🔑",
        isEvidence: false,
        interactions: { examine: { text: "На бирке номер 304-С.", timeCost: 5 } }
    });

    assert.deepEqual(harness.insights, []);
    assert.equal(harness.emitted.filter(event => event.name === "modal:show").length, 1);
});
