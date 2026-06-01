# API Integration Planning Bundle

Generated: 2026-06-01

Use these files to implement the new frontend's backend integration:

1. `00-backend-api-inventory.md` - current backend API contract and frontend route mapping.
2. `01-frontend-api-integration-plan.md` - task-by-task implementation plan.
3. `02-role-based-frontend-plan.md` - Analyst, Manager, CFO, Admin role behavior and Sidebar menu filtering.
4. `03-open-questions.md` - questions that must be asked instead of assumed during implementation.

Primary implementation target:

```bash
cd /home/tk-lpt-817/Desktop/mvp_sheet_sherlock/sheet-sherlock-detective
```

Backend reference target:

```bash
cd /home/tk-lpt-817/Desktop/mvp_sheet_sherlock/backend_code
```

Important boundary:
- These docs plan frontend integration only.
- Backend code already exposes the APIs listed in the inventory.
- If Manager review cannot access analyst-owned submitted projects, record that as a backend access-model follow-up during implementation rather than silently working around it in the frontend.
- If any implementation detail is unclear, add it to `03-open-questions.md` and ask the user before coding around the gap.
