# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Type

This is a **WeChat Mini Program (微信小程序)** — a client-side JavaScript application that runs inside WeChat. It is NOT a standard Node.js or web project. It uses the WeChat Mini Program framework (WXML/WXSS/JS) and WeChat Cloud Development (云开发) for the backend.

## Development Environment

- Open this project in **WeChat Developer Tools (微信开发者工具)** to run, preview, and debug.
- There is no `npm run dev` or local server. The simulator is inside the Developer Tools.
- The project config is in `project.config.json` (appid: `wxcae6a77804e65e58`).
- **Cloud environment ID**: `app.js:10` contains `cloudbase-d1gi41lf7db8fc30f`.

## Cloud Functions

Located in `cloudfunctions/`. Each has its own `package.json` with dependency `wx-server-sdk`.

| Function | Purpose |
|----------|---------|
| `login` | Queries or creates user doc by `_openid` (via `where`, not `doc`). Seeds default categories/sub-categories on first open. New users get `_id: openid` for compatibility. |
| `getMonthlyStats` | Aggregates records by category and computes 6-month trend. Supports both personal (`openid`) and family (`familyId`) queries. |
| `getFamilyStats` | Aggregates family-group records by category and member for the family page. |
| `getFamilyMembers` | Server-side query of user docs by `_openid` array. Needed because client-side `_openid` queries are restricted to current user. |
| `exportExcel` | Generates an HTML-table `.xls` file from records and uploads to cloud storage. |

**Deploying cloud functions**: Right-click each folder in WeChat Developer Tools → "Upload and deploy: Cloud function in the cloud" (上传并部署：云端安装依赖).

## Data Architecture

Uses WeChat Cloud Database (NoSQL) with these collections:

- `users` — `_id: openid`, `_openid`, `familyId`, `role`, `recordMode` (`simple` or `detailed`). New users have `_id` explicitly set to `openid` for direct lookup compatibility.
- `families` — `name`, `creatorOpenid`, `members` (array of openids), `inviteCode` (6-digit numeric string).
- `records` — `openid`, optional `familyId`, `type` (`income`/`expense`), `category`, optional `subCategory`, `amount` (number), `date` (Date), `note`.
- `categories` — per-user custom categories: `_openid`, `type`, `name`, `sortOrder`, `isDefault`.
- `subCategories` — per-user sub-categories: `_openid`, `parentCategory`, `name`, `sortOrder`.

### Data Access Pattern

All client-side DB access is abstracted in `utils/db.js`:
- `recordApi.getRecords(options)` — supports filtering by `openid`, `familyId`, `type`, `category`, `startDate`/`endDate`, and pagination (`page`/`pageSize`).
- `recordApi.addRecord/updateRecord/deleteRecord`
- `categoryApi.getCategories/getSubCategories` and CRUD operations
- `familyApi.getFamily/createFamily/updateFamily/deleteFamily/getFamilyByInviteCode`
- `userApi.getUser/updateUser` — queries by `_openid` field first, then operates by `_id`. Do NOT use `doc(openid)` directly.

Use `utils/db.js` for any new database operations rather than inline `wx.cloud.database()` calls.

### User compatibility note

Legacy users may have a random `_id` (not equal to `openid`). All user lookups MUST use `where({ _openid: openid })` first to obtain the real `_id`, then operate by `_id`. This applies to `userApi.getUser/updateUser`, `mine.js:switchRecordMode`, and the `login` cloud function.

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
| Export | `pages/export/export` | Export records to `.xls` (HTML table format). Opens via `wx.openDocument` with `fileType: 'xls'` and `showMenu: true` for save-to-phone. |

### Global State (`app.js`)

- `globalData.userInfo` — set after `login` cloud function returns. Contains `_openid`, `familyId`, `role`, `recordMode`.
- `globalData.recordMode` — `'simple'` (主分类 only) or `'detailed'` (主分类 + 子分类).
- `app.loginPromise` — Promise from `checkLogin()`. Pages MUST `await app.loginPromise.catch(() => {})` in `onLoad` and `onShow` before accessing `app.globalData.userInfo`.
- Login failures show a modal alert to the user.

### Key Patterns

1. **Login-first**: Every page that accesses `app.globalData.userInfo` must `await app.loginPromise.catch(() => {})` in both `onLoad` and `onShow` before using user data. Failure to do this causes the page to render with empty/default values on first open (especially for tab-bar pages where `onShow` fires before `onLoad`'s async body resumes).

2. **Loading guards**: Pages with cloud function calls (Index, Stat, Family) set `loading: true` before async work and check `if (this.data.loading) return;` at entry to prevent concurrent duplicate requests from `onLoad`/`onShow` overlap.

3. **Mode system**: The app supports two bookkeeping modes. `recordMode` controls whether sub-categories are required. First-time users are prompted via `wx.showActionSheet` on the Record page.

4. **Page refresh signaling**: When a record is saved, `record.js` sets `needRefresh: true` and calls `indexPage.loadData()` in `onUnload()`.

5. **Family record sync**: On create/join family, `syncRecordsFamilyId(openid, familyId)` updates all that user's records to the new `familyId`. On leave/dissolve/remove, `clearRecordsFamilyId(openid, familyId)` clears the `familyId` from their records. Both functions live in `family.js` and filter by `r.familyId !== familyId` (not `!r.familyId`) to correctly handle records with stale family IDs.

6. **Family member query**: Client-side `_openid` queries are restricted to the current user by the WeChat runtime. The `getFamilyMembers` cloud function is used server-side to retrieve all members of a family group.

7. **Default categories**: `login` cloud function seeds default expense and income categories for new users, with initial sub-categories.

8. **Canvas charts**: `stat.js` draws pie and trend charts manually with the 2D canvas API (`wx.createSelectorQuery` + `getContext('2d')`).

9. **Index pagination**: `loadData()` fetches up to 1000 records for the month into `allMonthRecords`, then slices in frontend for pagination. `loadMore()` slices from the cache — no additional DB queries.

10. **Export flow**: Cloud function generates HTML-table `.xls` → uploaded to cloud storage → client gets temp file URL → `wx.cloud.downloadFile({ fileID })` → `fs.saveFile` to `.xls` → `wx.openDocument({ fileType: 'xls', showMenu: true })`. User taps右上角 "..." to save to phone. CSV is NOT supported by `wx.openDocument` on real devices.

## Styling

- Uses WXSS (WeChat CSS) with CSS custom properties defined in `app.wxss`.
- Common utility classes: `.container`, `.card`, `.btn-primary`, `.empty-state`.
- Primary brand color: `#07c160`.
- Design is based on `rpx` units for responsive sizing.
