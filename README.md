# 題目十：structureData

把一段段描述商品的文字，轉成固定格式的資料。

```
輸入：[{ "content": "Waterproof outdoor shoe, cost 25." }, ...]
輸出：[{ "name": "Waterproof outdoor shoe", "category": "Footwear", "cost": 25 }, ...]
```

## 執行方式

需要 Node.js 18 以上，不用安裝任何套件。

```bash
node demo.js                     # 只用規則，可離線執行
node --env-file=.env demo.js     # 加上 LLM（需要 Node 20.6 以上，以及 .env 裡的 OPENAI_API_KEY）
node --test                      # 執行 6 個測試
```

`.env` 的格式（這個檔案已經列在 `.gitignore`，不要 commit）：

```
OPENAI_API_KEY=sk-...
```

## demo.js 在做什麼

`demo.js` 用兩組資料呼叫 `structureData`，展示不同情況下的結果：

**1. 題目指定的輸入**：輸出題目要求的 `{ name, category, cost }`。

| 輸入 | name | category | cost |
|---|---|---|---|
| Waterproof outdoor shoe, cost 25. | Waterproof outdoor shoe | Footwear | 25 |
| Running shoe, cost 20. | Running shoe | Footwear | 20 |

**2. 其他情況**：加上 `{ withMeta: true }`，多回傳 `_meta`，顯示每筆資料是怎麼處理的、有沒有問題。

| 輸入 | 情況 | 結果 | status |
|---|---|---|---|
| Hiking backpack, price: $32 | 價格寫法不同 | Bag，32 | `validated` |
| Trail running shoe | 沒有價格 | `cost: null` | `validated_with_warnings` |
| Mystery item, cost 15. | 看不出類別 | `category: null` | `needs_review` |

## 處理流程（structureData.js）

每一筆資料依序經過三個步驟：

1. **規則抽取**（`extractByRules`）
   - **cost**：用 regex 找出 `cost 25`、`price: $32`、`成本：30 元` 這類寫法。
   - **category**：比對關鍵字。例如 shoe、boot、鞋 → `Footwear`；bag、backpack、包 → `Bag`；jacket、shirt、衣、褲 → `Apparel`。
   - **name**：把價格那一段和結尾的標點去掉，剩下的文字就是名稱。
2. **LLM 補欄位**（`extractByLLM`，選用）
   - 只有在**有設定 API key**，而且**規則抽不完整**時才會呼叫。
   - 規則已經抽到的欄位不會被覆蓋，LLM 只補空著的欄位。
   - 用 JSON Schema 限制輸出格式，類別只能是 `Footwear`、`Bag`、`Apparel` 或 `null`。
   - System prompt 要求只能使用文字裡寫到的資訊，沒寫到就回傳 `null`，不要猜。
   - 呼叫失敗時，退回只用規則的結果，不會中斷程式。
3. **驗證**（`validate`），結果分成三種狀態：

| status | 意思 |
|---|---|
| `validated` | 三個欄位都正確 |
| `validated_with_warnings` | 只缺 cost，其他欄位可以用 |
| `needs_review` | 缺 name、缺 category，或 cost 不合法，需要人工確認 |

### 其他設計

- **規則優先**：規則快、免費、可以離線執行，結果也固定；只有規則處理不了的部分才交給 LLM。
- **不猜測**：缺少的欄位一律回傳 `null`，交給驗證步驟標記，不會產生假資料。
- **單筆失敗不影響其他筆**：某一筆出錯時，那一筆標記為 `needs_review`，其他筆照常處理。
- **限制併發**：預設同時處理 3 筆（`concurrency` 選項），避免一次對 API 送出太多請求。

## 測試（structureData.test.js）

| 測試 | 驗證的內容 |
|---|---|
| 題目範例輸入 | 輸出和題目要求完全一致 |
| 不同的成本寫法 | 支援 `price: $32` 和中文的 `成本：30 元` |
| 缺成本 | 回傳 `null`，狀態是 `validated_with_warnings` |
| 無法判斷類別 | 狀態是 `needs_review` |
| 壞資料不影響其他筆 | 輸入裡有 `null` 時，其他筆照常處理 |
| 輸入不是陣列 | 丟出 `TypeError` |

## 已知限制

- 中文類別關鍵字只用一個字比對，可能誤判。例如「麵包」裡有「包」，會被分到 `Bag`。
- 一段文字同時符合多個類別時，以先比對到的規則為準。例如「shoe bag」會被分成 `Footwear`。
