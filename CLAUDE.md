# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Type

This is a **WeChat Mini Program (微信小程序)** — a client-side JavaScript application that runs inside WeChat. It is NOT a standard Node.js or web project. It uses the WeChat Mini Program framework (WXML/WXSS/JS) and WeChat Cloud Development (云开发) for the backend.

## Development Environment

- Open this project in **WeChat Developer Tools (微信开发者工具)** to run, preview, and debug.
- There is no `npm run dev` or local server. The simulator is inside the Developer Tools.
- The project config is in `project.config.json` (appid: `wxcae6a77804e65e58`).
- **Cloud environment ID**: `app.js:11` contains `cloudbase-d1gi41lf7db8fc30f`.

## Cloud Functions

Located in `cloudfunctions/`. Each has its own `package.json` with dependency `wx-server-sdk`.

| Function | Purpose |
|----------|---------|
| `login` | Auto-creates user doc and default categories on first open. Sets up default expense/income categories. |
| `getMonthlyStats` | Aggregates records by category and computes 6-month trend for the stats page. |
| `getFamilyStats` | Aggregates family-group records by category and member for the family page. |
| `exportExcel` | Generates a CSV export of records and uploads it to cloud storage. |

**Deploying cloud functions**: Right-click each folder in WeChat Developer Tools → "Create and deploy: Cloud function" (上传并部署：云端安装依赖).

## Data Architecture

Uses WeChat Cloud Database (NoSQL) with these collections:

- `users` — `_openid` as doc ID, `familyId`, `role`, `recordMode` (`simple` or `detailed`).
- `families` — `name`, `creatorOpenid`, `members` (array of openids), `inviteCode` (6-digit numeric string).
- `records` — `openid`, optional `familyId`, `type` (`income`/`expense`), `category`, optional `subCategory`, `amount` (number), `date` (Date), `note`.
- `categories` — per-user custom categories: `openid`, `type`, `name`, `sortOrder`, `isDefault`.
- `subCategories` — per-user sub-categories: `openid`, `parentCategory`, `name`, `sortOrder`.

### Data Access Pattern

All client-side DB access is abstracted in `utils/db.js`:
- `recordApi.getRecords(options)` — supports filtering by `openid`, `familyId`, `type`, `category`, `startDate`/`endDate`, and pagination (`page`/`pageSize`).
- `recordApi.addRecord/updateRecord/deleteRecord`
- `categoryApi.getCategories/getSubCategories` and CRUD operations
- `familyApi.getFamily/createFamily/updateFamily/deleteFamily/getFamilyByInviteCode`

Use `utils/db.js` for any new database operations rather than inline `wx.cloud.database()` calls.

### Date Handling

- `utils/util.js` contains `formatDate`, `formatMonth`, `getMonthRange`.
- Dates are stored as JavaScript `Date` objects in the database.
- Queries use `_.gte(startDate).and(_.lte(endDate))`.

## Application Architecture

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| Index | `pages/index/index` | Monthly transaction list with pull-to-refresh and infinite scroll. Grouped by date. |
| Record | `pages/record/record` | Add or edit a transaction. Supports simple/detailed mode. |
| Stat | `pages/stat/stat` | Monthly statistics with pie chart and trend line drawn on canvas. |
| Family | `pages/family/family` | Create/join/leave/dissolve family groups, view member stats. |
| Mine | `pages/mine/mine` | User profile and settings. |
| Category | `pages/category/category` | Manage custom categories and sub-categories. |
| Export | `pages/export/export` | Export records to CSV via `exportExcel` cloud function. |

### Global State (`app.js`)

- `globalData.userInfo` — set after `login` cloud function returns. Contains `_openid`, `familyId`, `role`, `recordMode`.
- `globalData.recordMode` — `'simple'` (主分类 only) or `'detailed'` (主分类 + 子分类).
- `globalData.familyInfo` — currently unused.
- `app.indexPageCallback` — hack used in `checkLogin()` to notify the index page once login completes.

### Key Patterns

1. **Mode system**: The app supports two bookkeeping modes. `recordMode` controls whether sub-categories are required. First-time users are prompted via `wx.showActionSheet` on the Record page.
2. **Page refresh signaling**: When a record is saved, `record.js` sets `needRefresh: true` and calls `indexPage.loadData()` in `onUnload()`.
3. **Family sharing**: Records tagged with `familyId` are included in family stats. The creator can manage members; members can only leave.
4. **Default categories**: `login` cloud function seeds default expense and income categories for new users.
5. **Canvas charts**: `stat.js` draws pie and trend charts manually with the 2D canvas API (`wx.createSelectorQuery` + `getContext('2d')`).

## Styling

- Uses WXSS (WeChat CSS) with CSS custom properties defined in `app.wxss`.
- Common utility classes: `.container`, `.card`, `.btn-primary`, `.empty-state`.
- Primary brand color: `#07c160`.
- Design is based on `rpx` units for responsive sizing.
