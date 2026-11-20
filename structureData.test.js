// 執行：node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { structureData } = require("./structureData");

test("題目範例輸入", async () => {
  const out = await structureData([
    { content: "Waterproof outdoor shoe, cost 25." },
    { content: "Running shoe, cost 20." },
  ]);
  assert.deepEqual(out, [
    { name: "Waterproof outdoor shoe", category: "Footwear", cost: 25 },
    { name: "Running shoe", category: "Footwear", cost: 20 },
  ]);
});

test("不同的成本寫法", async () => {
  const [a, b] = await structureData([
    { content: "Hiking backpack, price: $32" },
    { content: "防水登山鞋，成本：30 元" },
  ]);
  assert.equal(a.cost, 32);
  assert.equal(a.category, "Bag");
  assert.equal(b.cost, 30);
  assert.equal(b.category, "Footwear");
});

test("缺成本：不猜，回傳 null 並標記警告", async () => {
  const [r] = await structureData([{ content: "Trail running shoe" }], { withMeta: true });
  assert.equal(r.cost, null);
  assert.equal(r._meta.status, "validated_with_warnings");
});

test("無法判斷類別：送人工複核", async () => {
  const [r] = await structureData([{ content: "Mystery item, cost 15." }], { withMeta: true });
  assert.equal(r.category, null);
  assert.equal(r._meta.status, "needs_review");
});

test("壞資料不影響其他筆", async () => {
  const out = await structureData([null, { content: "Running shoe, cost 20." }], { withMeta: true });
  assert.equal(out[0]._meta.status, "needs_review");
  assert.equal(out[1].cost, 20);
});

test("輸入不是陣列就丟錯", async () => {
  await assert.rejects(() => structureData("oops"), TypeError);
});
