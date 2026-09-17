# 課堂座位表與課堂常規管理系統 (Classwork Marker Pro)

> 專為中小學及大專教師設計的現代化、輕量化、流動裝置友好的課堂座位管理與教學輔助系統。  
> 老師可以在手機或平板電腦上實時點名、批改作業繳交狀態、記錄課堂行為印章；同時可一鍵切換「學生/投影機視角（旋轉 180°）」投屏至大螢幕，與學生視角完美一致。

---

## 🌟 核心特色功能

- 🪑 **互動式座位表 (Interactive Seating Plan)**
  - 自由拖曳調位、交換座位，支援多達 40 步復原 (Undo)。
  - **雙重視角一鍵切換**：教師視角（講台視角，1號在左下）與學生視角（投影機投屏視角，旋轉 180°，1號在右上）。
  - 座位外觀自訂：支援男女生邊框顏色區分、單雙行交替背景色、課桌自訂尺寸與字體大小。

- ⚡ **即時作業與工作紙繳交點名 (Tap-Off Marking)**
  - 輕觸課桌即時標記繳交／未交，附帶精確時間戳記。
  - 頂部實時進度條，一眼掌握全班繳交進度（如：`28 / 32 handed in`）。
  - 多裝置實時同步（手機勾選，電腦投影螢幕 3.5 秒內自動更新）。

- 🏅 **浮動印章箱與違規行為追蹤 (Discipline & Commendation)**
  - 可隨意拖曳停靠的浮動印章箱，單擊即時貼上表揚印章（積極答問、專注投入）或違規標籤（欠帶課本、說話分心、課堂睡覺）。
  - 學生專屬歷史紀錄彈窗：分類篩選、印章累計統計、歷次課堂時間線。
  - **連續違規警報**：系統自動比對對上班別歷史，若學生在連續課堂出現相同違規（例如連續兩堂欠帶課本），自動亮起醒目預警標籤。

- ⏱️ **洗手間計時與電子設備登記 (Washroom Timer & Device Tracker)**
  - **去洗手間動態計時**：一鍵記錄離室時間，座位卡片顯示高對比度 5 秒柔和呼吸提示與雙行分秒計時標籤，隨時掌握學生外出的時間，學生回座後一鍵銷假。
  - **電子設備使用登記**：專為電腦室及自攜裝置 (BYOD) 課堂設計，快速標記學生使用平板或手機之學習狀態。

- 📅 **循環週校曆與上課時段偵測 (6-Day Cycle Schedule)**
  - 支援 6-Day Cycle 循環上課日偵測。
  - 自動判斷當前節數與科目教室，動態提示「現正上課中」或「非本日課堂（補堂／調堂模式）」，支援一鍵跳轉至排程上一堂課。

- 📥 **智能名單匯入與 xClass 導出**
  - **智能文字解析**：直接複製 Excel 或 Google 試算表的名單貼入，自動提取學號、中文名、英文名與性別。
  - **電腦室 xClass CSV 匯出**：相容 Mythware、NetSupport 等電腦課室管理軟體，匯出帶有課桌座標與 UTF-8 BOM 的名單檔案。

---

> 🌐 **線上體驗網址 (Live Demo)**: [https://classwork-marker-public.vercel.app/](https://classwork-marker-public.vercel.app/)  
> 🔑 **體驗解鎖密碼**: `20252026`（已預載 1A 班示範名單、課桌排列與印章記錄，歡迎直接體驗！）

---

## 🛠️ 事前準備與資源需求 (Prerequisites & Options)

本系統支援 3 種不同部署與使用方案，老師可依學校 IT 環境與個人偏好選擇：

| 部署方案 | 適合對象 | 所需資源與帳號 | 優點與特性 |
| :--- | :--- | :--- | :--- |
| **方案 A：Vercel + Neon 雲端託管**<br>*(最推薦 / 零技術門檻)* | 一般中小學老師、科組共用、跨裝置教學 | 1. **GitHub 帳號**（免費）<br>2. **Vercel 帳號**（免費個人 Hobby Plan）<br>3. **Neon PostgreSQL**（於 Vercel 內一鍵免費開通） | • 零主機費用，全球 CDN 加速<br>• 手機、平板、電腦即時同步<br>• 自動 HTTPS 與免維護 |
| **方案 B：Google 試算表 (GAS) 版**<br>*(Google Workspace 學校首選)* | 習慣使用 Google 試算表、完全不想註冊雲端服務的老師 | 1. **Google 帳號**（個人或校園 Google Workspace 帳號）<br>2. **Google 試算表 (Google Sheets)** | • 完全免註冊 GitHub 或 Vercel<br>• 資料直接存在試算表，匯入匯出方便<br>• 詳見 [apps-script/README.md](./apps-script/README.md) |
| **方案 C：自建伺服器 / 本機離線版**<br>*(極致隱私 / 校內區域網路)* | 學校 IT 技術人員、電腦室內部獨立離線使用 | 1. **Node.js 20+** 或 **Docker**<br>2. 校內私有伺服器或本機電腦<br>3. （可選）自行架設的 PostgreSQL 或內建純記憶體 DB | • 100% 離線運作，資料不出校門<br>• 支援學校電腦室內部網路直接部署 |

---

## 🚀 3 步零代碼部署指南 (Vercel + Neon Postgres 方案)

本系統使用 **Vercel Serverless Functions + Neon Serverless Postgres**，完全免費且無需伺服器維護費用。

### 第一步：Fork 此專案到自己的 GitHub
1. 點擊本專案右上角的 **`Fork`** 按鈕。
2. 選擇你的個人 GitHub 帳號，點擊 **Create fork**。

### 第二步：連接至 Vercel 並建立免費資料庫
1. 登入 [Vercel](https://vercel.com)（可用 GitHub 帳號一鍵登入）。
2. 點擊右上角 **Add New... ▸ Project**，找到並匯入剛才 Fork 的 `classwork-marker-public`。
3. **建立資料庫**：在專案部署頁面或專案設定中，進入 **Storage** 分頁，點擊 **Connect Store ▸ Neon (Postgres)** 免費建立資料庫。
   - Vercel 會**自動**將 `DATABASE_URL` 注入到你的環境變數中，無需手動複製連線字串！

### 第三步：設定環境變數並部署上線
在 Vercel 專案設定的 **Environment Variables** 加入以下兩個變數：

| 環境變數名稱 | 說明 | 範例值 |
| :--- | :--- | :--- |
| **`APP_PASSCODE`** | 教師登入密碼（設定便於手機輸入的密碼） | `20252026` |
| **`AUTH_SECRET`** | 用於簽署安全 Cookie 的 32 位元隨機字串 | 可在終端機執行 `openssl rand -base64 32`，或輸入隨機字串 |

點擊 **Deploy**，約 30 秒即可完成發布！初次載入網頁時，資料庫會**自動建立資料表並載入 1A 與 2A 示範名單**，即可開始體驗！

---

## 🤖 零基礎教師專用：帶上你的 AI 助手 (Bring Your Own AI)

如果你完全沒有程式開發背景，不知如何操作 GitHub 或 Vercel，**請不用擔心！**

我們為你準備了一份專門寫給 AI 的引導提示詞。你只需要打開 **ChatGPT、Claude、Google Gemini、Cursor 或 Copilot**，將 [`AI_SETUP_PROMPT.md`](./AI_SETUP_PROMPT.md) 裡的內容複製貼上給它：

> 📋 **點此查看完整引導提示詞：[AI_SETUP_PROMPT.md](./AI_SETUP_PROMPT.md)**

AI 助手會以耐心、親切的繁體中文，一步一步帶你完成 Fork、Vercel 註冊、資料庫開通與學生名單匯入！

---

## 💻 本機免資料庫開發與測試 (Local Development)

本專案內建**純記憶體資料庫模擬器 (In-Memory Postgres)**，本機執行完全不需要安裝 PostgreSQL 或設定連線字串：

```bash
# 1. 安裝專案相依套件
npm install

# 2. 啟動本機開發伺服器
npm run dev
```

在瀏覽器打開 [http://localhost:3000](http://localhost:3000)：
- 預設登入密碼：`20252026`（亦可在 `.env` 自訂）
- 系統已預載 1A 班示範學生（陳大文、黃小明等 20 位學生）與課堂印章。

---

## 📑 Google Apps Script (GAS) 試算表免伺服器版

如果你更習慣使用 **Google 試算表 (Google Sheets)** 來管理學生名單與課堂成績，本專案亦提供專為 Google 生態系設計的 Apps Script 版本：
- 資料完全保存在你個人的 Google 試算表中，免伺服器費用。
- 請參閱專屬部署教學：**[apps-script/README.md](./apps-script/README.md)**。

---

## 📖 教師操作指引

### 1. 新增班別與設定容量
1. 輸入密碼登入系統。
2. 點擊導覽列的 **「班別設定」**。
3. 點擊 **「＋ 新增班別」**，輸入班別名稱（例如 `1A`、`2B`）、學生總人數與每行座位欄數。

### 2. 智能匯入學生名單
1. 前往 **「學生名單」** 頁面，選擇相應班別。
2. 點擊工具列的 **「📥 匯入名單」** 按鈕。
3. 直接從學校的 Excel 或 Google Sheets 複製學生名單並貼入文字框，系統能自動辨認學號、中英文姓名與性別。
4. 預覽無誤後點擊 **「套用名單」** 即可。

### 3. 排列課室座位
1. 進入 **「座位排列」** 模式。
2. 將未入座的學生卡片拖曳至課桌格子中。
3. 支援兩兩互換位置、一鍵順序入座 (Fill in order)、鏡像翻轉 (Mirror) 與多達 40 步復原 (Undo)。
4. 點擊 **「儲存排列」** 完成佈局。

### 4. 外部電腦室軟體連動 API (`/api/external`)
電腦課室的自動評分腳本、學生端程式或自動化工具可透過 HTTP POST 標記學生繳交狀態：

```bash
curl -X POST https://your-app.vercel.app/api/external \
  -H "Content-Type: application/json" \
  -H "x-api-key: teach2026" \
  -d '{"class": "1A", "student_no": 12, "status": "marked"}'
```

批次標記多位學生：
```json
{
  "class": "1A",
  "students": [1, 5, 12, 18],
  "status": "marked"
}
```

---

## 📂 檔案目錄結構

```
├── api/                        # Vercel Serverless Functions
│   ├── login.js                # 密碼登入與 Signed Cookie 簽署
│   ├── bundle.js               # 單次往返資料打包（班級、座位、名單、繳交、印章）
│   ├── status.js               # 輕量級即時輪詢端點 (3.5s)
│   ├── action.js               # 資料寫入 (點名、印章、常規紀錄、座位儲存)
│   └── external.js             # 電腦室外部軟體同步 API
├── lib/                        # 後端核心模組
│   ├── auth.js                 # HMAC 驗證與定時比對
│   ├── db.js                   # PostgreSQL 連線池與自動 Schema/Demo 建置
│   └── schedule-engine.js      # 課堂排程模組接口
├── public/                     # 前端單頁應用 (SPA)
│   ├── index.html              # 響應式介面結構與彈窗
│   ├── styles.css              # 座位表網格、浮動工具箱與主題樣式
│   ├── app.js                  # 前端核心業務邏輯與離線狀態管理
│   └── schedule-data.js        # 循環週校曆與節數排程引擎
├── apps-script/                # Google Apps Script 試算表免伺服器版本
│   ├── Code.gs                 # Apps Script 後端邏輯與示範資料建置
│   ├── index.html              # Apps Script 網頁介面
│   ├── styles.html             # Apps Script 樣式表
│   ├── script.html             # Apps Script 前端腳本
│   └── README.md               # Apps Script 3分鐘架設教學
├── dev/                        # 本機開發輔助工具
│   ├── server.mjs              # 輕量本機 HTTP 伺服器
│   ├── memory-pg.mjs           # 記憶體內建 PostgreSQL 模擬器
│   ├── generate_xclass_csv.mjs # 離線批次 xClass CSV 匯出腳本
│   └── test-schedule.mjs       # 排程引擎單元測試
├── xclass_csv/                 # xClass 座標與名單範本
│   ├── sample_template.csv     # 示範 xClass 學生座次範本
│   └── README.md               # xClass 格式說明文件
├── AI_SETUP_PROMPT.md          # 零基礎教師專用 AI 引導提示詞
├── .env.example                # 環境變數設定範本
└── vercel.json                 # Vercel 路由與靜態快取規則
```

---

## 🔒 私隱與安全保障 (Privacy Guarantee)

- 本公開專案已徹底清除所有真實學生名單、個人聯絡方式與私人資料庫連線字串。
- 專案內所有預載學生均為虛構示範人物（如：陳大文、黃小明）。
- 資料庫連線完全由使用者在個人 Vercel / Google Sheets 自行掌控，程式碼開源透明。

---

## 📄 授權條款 (License)

採用 [MIT License](LICENSE) 授權釋出。歡迎全球教師與教育機構自由使用、修改及推廣於課堂教學。
