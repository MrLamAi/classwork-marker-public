# 🤖 帶上你的專屬 AI 助手 (Bring Your Own AI Setup Prompt)

如果你是一位學校教師或初學者，沒有程式編寫背景，**請不要擔心！**
你可以直接將下方的 **AI Prompt（引導提示詞）** 複製，貼到任何你常用的 AI 工具（例如 **ChatGPT、Claude、Google Gemini、Cursor、Copilot**）。

AI 助手會以繁體中文、溫柔且一步步地指導你完成所有設定！

---

## 📋 複製以下內容並貼給你的 AI：

```text
你好！我剛剛在 GitHub 上 Fork 了一個開源的學校課堂管理與座位表工具（Classwork Marker）。
我是一位學校老師，沒有軟體開發背景。我想把它部署上線給自己（或科組同事）在課堂上使用。

請扮演一位耐心、友善、專業的技術導師，使用繁體中文（香港/台灣常用術語），一步一步引導我完成整個設定。

請遵循以下引導原則：
1. 每次只向我提出一個步驟或一個問題，等我回覆「完成」或提問後，再給下一個步驟。不要一次丟出整篇冗長的指令。
2. 解釋要通俗易懂，把名詞用生活化比喻（例如：Vercel 是免費放網頁的地方、Neon 是存學生名單的雲端筆記本）。
3. 主動提醒我哪些密碼或金鑰屬於隱私，不要外洩。

請引導我完成以下四個核心任務：
【任務一：Fork 與 Vercel 連接】
- 確認我已將專案 Fork 到我的 GitHub 帳號。
- 教我如何登入 Vercel (https://vercel.com) 並匯入此專案。

【任務二：免費建立 Neon PostgreSQL 資料庫】
- 教我如何在 Vercel Marketplace 免費加入 Neon 資料庫，自動取得 DATABASE_URL。

【任務三：設定環境變數 (Environment Variables)】
- 告訴我需要設定哪兩個變數：APP_PASSCODE（老師手機登入密碼）與 AUTH_SECRET（安全驗證金鑰）。
- 提供一個安全生成 AUTH_SECRET 的方法或幫我生成一組隨機字串。

【任務四：一鍵部署與初次登入】
- 引導我點擊 Deploy 部署，並在手機或電腦瀏覽器打開網址。
- 說明預設的 Demo 班級（1A），以及如何用「匯入名單」把我自己班級的 Excel 學生名單貼進去。

現在，請從「第一步：確認 GitHub Fork 與登入 Vercel」開始引導我吧！
```

---

## 💡 AI 引導流程簡介

你的 AI 助手會帶你走過以下 4 個簡單步驟：
1. **GitHub Fork**：在專案右上角點擊 **Fork** 複製到你自己的帳號。
2. **Vercel 匯入**：登入 Vercel，點擊 **Import Project**。
3. **儲存庫與密碼設定**：
   - 加入免費 **Neon Postgres**（自動綁定 `DATABASE_URL`）
   - 設定 `APP_PASSCODE`（你的課堂登入密碼）
   - 設定 `AUTH_SECRET`（安全金鑰）
4. **上線使用**：點擊 Deploy，在手機加入主畫面，即可開始在課堂上點名、貼印章、排座位！
