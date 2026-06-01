# API Integration Open Questions

Generated: 2026-06-01

Instruction for implementation workers:

- Do not assume answers for product, role, workflow, or backend-contract gaps.
- If a blocker appears during implementation, add the question here and ask the user before coding around it.
- Keep each question concrete and include the file or API endpoint that raised it.

## Current Questions

No open questions from the planning pass.

## Question Template

```md
### QN: Short question title

**Context:** File, screen, or endpoint involved.

**Question:** The exact decision needed.

**Why it matters:** What changes depending on the answer.

**Options if useful:**

- Option A: impact
- Option B: impact

**Status:** Open
```

## Resolved Questions

### Q1: Should backend review-cell endpoints be removed with Diff Review?

**Context:** Frontend Diff Review route removal and backend endpoints `PATCH /api/projects/{project_id}/review-cells/{field_id}` and `POST /api/projects/{project_id}/review-cells/{field_id}/revert`.

**Decision:** Do not remove the backend endpoints for now.

**Implementation impact:** Remove the Diff Review frontend route/menu/linking, but keep backend review-cell APIs available for diagnosis/workflow screens and manager-submission blocking checks.
