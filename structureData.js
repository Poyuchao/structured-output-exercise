// 題目十：資料結構化
// 輸入：[{ content: "Waterproof outdoor shoe, cost 25." }, ...]
// 輸出：[{ name, category, cost }, ...]
//
// 設計：規則優先（快、免費、可離線、結果固定），
//       規則抽不完整時才交給 LLM（選用），最後一律經過驗證。

const CATEGORY_RULES = [
  { category: "Footwear", pattern: /\b(shoes?|sneakers?|boots?|sandals?|slippers?)\b|鞋/i },
  { category: "Bag", pattern: /\b(bags?|backpacks?|handbags?)\b|包/i },
  { category: "Apparel", pattern: /\b(jackets?|shirts?|pants|hoodies?|coats?)\b|衣|褲/i },
];

const CATEGORIES = CATEGORY_RULES.map((r) => r.category);

// 「cost 25」「price: $20」「成本：30 元」
const COST_PATTERN =
  /(?:cost|price|成本|價格)\s*(?:is|=|:|：)?\s*(?:NT\$|US\$|\$)?\s*(\d+(?:\.\d+)?)/i;

// ---------- 1. 規則抽取 ----------
function extractByRules(content) {
  const text = String(content ?? "").trim();

  const costMatch = text.match(COST_PATTERN);
  const cost = costMatch ? Number(costMatch[1]) : null;

  // 名稱：拿掉成本那段與結尾標點，剩下的就是品名
  const name = text
    .replace(COST_PATTERN, "")
    .replace(/[,，;；]\s*$/, "")
    .replace(/[.。\s,，]+$/, "")
    .trim();

  const rule = CATEGORY_RULES.find((r) => r.pattern.test(text));
  const category = rule ? rule.category : null;

  return { name: name || null, category, cost };
}

// ---------- 2. LLM 抽取（選用，規則抽不完整時才用） ----------
async function extractByLLM(content, { apiKey, model = "gpt-4o-mini" }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "從文字中擷取商品欄位。只能使用文字中出現的資訊。" +
            "如果某個欄位沒有提到，就回傳 null。不要猜測。",
        },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "product",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["name", "category", "cost"],
            properties: {
              name: { type: ["string", "null"] },
              category: { type: ["string", "null"], enum: [...CATEGORIES, null] },
              cost: { type: ["number", "null"] },
            },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// ---------- 3. 驗證 ----------
function validate(item) {
  const issues = [];
  if (typeof item.name !== "string" || item.name.length === 0) issues.push("name: missing");
  if (!CATEGORIES.includes(item.category)) issues.push("category: unknown");
  if (item.cost === null) issues.push("cost: missing");
  else if (!Number.isFinite(item.cost) || item.cost < 0) issues.push("cost: invalid");

  // 缺 name 或 category → 需人工複核；只缺 cost → 有警告但可用
  const critical = issues.some((i) => i.startsWith("name") || i.startsWith("category") || i === "cost: invalid");
  const status = issues.length === 0 ? "validated" : critical ? "needs_review" : "validated_with_warnings";
  return { status, issues };
}

function isComplete(item) {
  return item.name && item.category && item.cost !== null;
}

// ---------- 處理單筆 ----------
async function structureOne(raw, options) {
  const content = raw?.content;
  let item = extractByRules(content);
  let method = "rule";

  if (!isComplete(item) && options.apiKey) {
    try {
      const llm = await extractByLLM(content, options);
      // 規則抽到的優先，LLM 只補空缺
      item = {
        name: item.name ?? llm.name,
        category: item.category ?? llm.category,
        cost: item.cost ?? llm.cost,
      };
      method = "rule+llm";
    } catch (err) {
      method = "rule (llm failed)";
    }
  }

  const { status, issues } = validate(item);
  return { ...item, _meta: { method, status, issues } };
}

// ---------- 主函式 ----------
async function structureData(rawData, options = {}) {
  if (!Array.isArray(rawData)) throw new TypeError("rawData must be an array");

  const { withMeta = false, concurrency = 3 } = options;
  const results = new Array(rawData.length);

  // 限制同時處理的數量（呼叫 LLM 時避免打爆 API）；單筆失敗不影響其他筆
  let next = 0;
  async function worker() {
    while (next < rawData.length) {
      const i = next++;
      try {
        results[i] = await structureOne(rawData[i], options);
      } catch (err) {
        results[i] = {
          name: null, category: null, cost: null,
          _meta: { method: "error", status: "needs_review", issues: [String(err.message)] },
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rawData.length) }, worker));

  if (withMeta) return results;
  return results.map(({ name, category, cost }) => ({ name, category, cost }));
}

module.exports = { structureData, extractByRules, validate };
