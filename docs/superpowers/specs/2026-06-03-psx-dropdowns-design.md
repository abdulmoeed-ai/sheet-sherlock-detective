# PSX Company Dropdowns & Analyst Email Select — Design Spec

**Date:** 2026-06-03  
**Feature:** Replace free-text inputs in the Manager Request form with data-driven dropdowns  
**Status:** Approved

---

## 1. Problem

The `ManagerDashboard` request form uses plain `<input>` fields for Company, Symbol, Sector, and Analyst Email. This allows typos, inconsistent values, and requires the manager to know PSX symbols and analyst emails from memory.

---

## 2. Goals

1. Company, Symbol, and Sector sourced from live PSX data (all 460+ listed companies).
2. Analyst email selected from real users in the database (finance_analyst role).
3. All applicable fields converted to dropdowns or searchable comboboxes.
4. The `AnalysisRequestCreateInput` payload sent to the backend is unchanged.

---

## 3. Data Sources

### PSX Companies
- **Source:** `https://dps.psx.com.pk/market-watch` — official PSX endpoint, no auth, JSON, 460+ companies.
- **Backend proxy:** `GET /api/psx/companies` fetches and caches this for 24 hours (module-level in-process cache with timestamp TTL).
- **Cache behaviour:** If PSX is unreachable and cache is warm, serve stale data. If cache is cold and PSX is unreachable, return HTTP 503.
- **Response shape:** `[{ name: string, symbol: string, sector: string }]` sorted by name.

### Analysts
- **Source:** `users` table, `role = "finance_analyst"`.
- **Backend endpoint:** `GET /api/users/analysts` — any authenticated user may call it.
- **Response shape:** `[{ email: string, name: string }]` sorted by email.

---

## 4. Backend Changes

### 4.1 `UserRepository` (`app/repositories/users.py`)
Add method:
```python
async def list_by_role(self, role: str) -> list[User]:
    result = await self.session.scalars(
        select(User).where(User.role == role).order_by(User.email)
    )
    return list(result.all())
```

### 4.2 New route: `app/api/routes/users.py`
```
GET /api/users/analysts
  Auth: any logged-in user (CurrentUserDep)
  Returns: [{ email, name }]
```

### 4.3 New route: `app/api/routes/psx.py`
```
GET /api/psx/companies
  Auth: any logged-in user (CurrentUserDep)
  On call: check module-level cache; if stale (>24h) or empty, fetch dps.psx.com.pk/market-watch
  Parse: extract name, symbol, sector from each record; sort by name
  On PSX failure + warm cache: return stale data
  On PSX failure + cold cache: raise HTTP 503
  Returns: [{ name, symbol, sector }]
```

Cache implementation: module-level dict `_cache = {"data": None, "fetched_at": None}` — no Redis, no DB.

### 4.4 `app/main.py`
Register both new routers.

---

## 5. Frontend Changes

### 5.1 New API functions — `src/lib/api/users.ts`
- `listAnalysts()` → `GET /api/users/analysts`
- `listPsxCompanies()` → `GET /api/psx/companies`

### 5.2 Query keys — `src/lib/api/query-keys.ts`
Add:
- `analysts: ["users", "analysts"]`
- `psxCompanies: ["psx", "companies"]`

### 5.3 New hooks — `src/hooks/use-users.ts`
- `useAnalysts()` — `useQuery` wrapping `listAnalysts()`
- `usePsxCompanies()` — `useQuery` wrapping `listPsxCompanies()`

### 5.4 New component — `src/components/Combobox.tsx`
Reusable searchable dropdown built on existing `Popover` + `Command` + `CommandInput` (already installed).

Props:
```ts
interface ComboboxProps {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
}
```

Behaviour:
- Trigger button matches the height/border style of the existing `Field` component (`h-10`, `rounded-md border`).
- Opens a `PopoverContent` containing a `Command` with `CommandInput` for live search and a scrollable `CommandList`.
- Shows selected label in trigger; shows placeholder when empty.
- Selecting an item closes the popover and calls `onChange`.

### 5.5 Updated form — `src/routes/index.tsx`

| Field | Before | After |
|---|---|---|
| Assigned analyst email | Free text `<input>` | `Combobox` — options from `useAnalysts()`, `label` = `"Name (email)"` so searchable by both; stored `value` = email |
| Company | Free text `<input>` | `Combobox` — options from `usePsxCompanies()`, searchable by name or symbol; selecting auto-fills Symbol and Sector |
| Symbol | Free text `<input>` | Read-only styled field, value set by company selection |
| Sector | Free text `<input>` | Read-only styled field, value set by company selection |
| Fiscal year | Free text `<input>` | `<select>` with options FY2020–FY2026 |
| Priority | `<select>` | No change |
| Due date | `<input type="date">` | No change |
| Note | `<textarea>` | No change |

**Company selection logic:**
When the manager selects a company from the combobox, `draft.companyName`, `draft.companySymbol`, and `draft.sector` are all updated in one `setDraft` call. Symbol and Sector are displayed as read-only `<input disabled>` fields with greyed styling so the manager can see the values but knows they are auto-filled.

**Loading states:** While `useAnalysts()` or `usePsxCompanies()` are loading, the relevant combobox trigger is disabled with a "Loading…" placeholder.

**Error states:** If PSX fetch fails (503), the Company combobox trigger is disabled and shows "PSX data unavailable — try refreshing". The manager cannot proceed with company selection until the data loads. No free-text fallback (avoids inconsistent values entering the system).

---

## 6. What Does Not Change

- `AnalysisRequestCreateInput` type and shape — unchanged.
- The API call `createAnalysisRequest(draft)` — unchanged.
- All other form fields (due date, note, priority, template) — unchanged.
- No new database tables or migrations required.

---

## 7. Files Touched

**Backend:**
- `backend/app/repositories/users.py` — add `list_by_role`
- `backend/app/api/routes/users.py` — new file
- `backend/app/api/routes/psx.py` — new file
- `backend/app/main.py` — register routers

**Frontend:**
- `src/lib/api/users.ts` — new file
- `src/lib/api/query-keys.ts` — add 2 keys
- `src/hooks/use-users.ts` — new file
- `src/components/Combobox.tsx` — new file
- `src/routes/index.tsx` — update form
