# Google Apps Script (GAS) 部署指南

本系統提供專為 Google 生態系設計的 **Google Apps Script (GAS) 免伺服器版本**。
資料完全儲存於您個人的 **Google 試算表 (Google Sheets)**，免除任何伺服器費用與資料庫設定。

---

## 🚀 3 分鐘部署步驟

### 第一步：建立 Google 試算表
1. 前往 [Google Sheets](https://sheets.new) 建立一張全新的空白 Google 試算表。
2. 將試算表命名為「課堂座位表與點名系統（Marker Pro）」。

### 第二步：開啟 Apps Script 編輯器
1. 在試算表頂部選單點擊：**擴充功能 (Extensions) ▸ Apps Script**。
2. 系統會開啟專屬的腳本編輯視窗。

### 第三步：複製專案程式碼
在左側「檔案」面板中，建立以下 4 個檔案並貼上本資料夾對應的程式碼：

| 試算表內的檔案名稱 | 類型 | 對應本專案檔案 | 備註 |
| :--- | :--- | :--- | :--- |
| **`Code.gs`** | 指令碼 (.gs) | `apps-script/Code.gs` | 核心邏輯與試算表讀寫 |
| **`index`** | HTML (.html) | `apps-script/index.html` | 前端頁面結構（檔名請勿填 .html） |
| **`styles`** | HTML (.html) | `apps-script/styles.html` | 座位表與視覺樣式（檔名請勿填 .html） |
| **`script`** | HTML (.html) | `apps-script/script.html` | 拖曳互動與客戶端邏輯（檔名請勿填 .html） |

> ⚠️ **注意**：Google Apps Script 的 HTML 檔案名稱**不需要輸入 `.html`**，請直接命名為 `index`、`styles`、`script`。

### 第四步：部署為網頁應用程式 (Web App)
1. 點擊右上角藍色按鈕 **部署 (Deploy) ▸ 新增部署 (New deployment)**。
2. 點擊左側齒輪圖示，選擇 **網頁應用程式 (Web app)**。
3. 設定項目：
   - **說明**：`v1.0 課堂管理系統`
   - **執行身分**：`我 (Me)`
   - **誰可以存取**：`只有我自己`（或`您機構中的任何人` / `所有人`，依學校需求而定）
4. 點擊 **部署 (Deploy)**，初次執行需授權 Google 帳號存取試算表。
5. 複製產生的 **網頁應用程式網址 (Web App URL)**，在手機、平板或電腦瀏覽器打開即可使用！

---

## 📊 試算表結構說明 (初次載入會自動建立)

首次開啟網頁應用程式時，程式會自動在試算表中建立預設工作表與示範名單：
- **`Config`**：設定各班級名稱、學生人數上限與排列欄數（預設包含 1A、2A）。
- **`Students`**：學生名單（班別、學號、英文名、中文名、偏好名、性別）。
- **`Layout`**：各班級課桌座位排列字串。
- **`Sessions`**：記錄建立的課堂與工作紙 ID。
- **`<班級名稱>` (如 `1A`)**：即時點名與繳交作業的時間戳記記錄。
