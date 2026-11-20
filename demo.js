// 執行：node demo.js
// 有設定 OPENAI_API_KEY 才會啟用 LLM 補欄位；沒設定就純規則（可離線）
const { structureData } = require("./structureData");

const rawData = [
  { content: "Waterproof outdoor shoe, cost 25." },
  { content: "Running shoe, cost 20." },
];

const extra = [
  { content: "Hiking backpack, price: $32" },   // 不同寫法
  { content: "Trail running shoe" },            // 缺成本
  { content: "Mystery item, cost 15." },        // 無法判斷類別
];

(async () => {
  const options = { apiKey: process.env.OPENAI_API_KEY };

  console.log("=== 1. 題目輸入 ===");
  console.log(JSON.stringify(await structureData(rawData, options), null, 2));

  console.log("\n=== 2. 其他情況（附驗證狀態）===");
  console.log(JSON.stringify(await structureData(extra, { ...options, withMeta: true }), null, 2));
})();
