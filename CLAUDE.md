# CLAUDE.md — Real Property Tax Administration System (RPTAS)
**Municipality of Santa Rosa, Province of Nueva Ecija, Philippines**

---

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. [`context/project-overview.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/context/project-overview.md) — Product definition, statutory goals, municipal features, and operational scope.
2. [`context/architecture.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/context/architecture.md) — System boundaries, repository driver model, schemas, and statutory invariants.
3. [`context/ui-context.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/context/ui-context.md) — Santa Rosa Treasury theme, emerald tokens, typography, and shadcn/ui component conventions.
4. [`context/code-standards.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/context/code-standards.md) — TypeScript strict standards, repository pattern, and clean architecture rules.
5. [`context/ai-workflow-rules.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/context/ai-workflow-rules.md) — Local-only git directive (never push), change budgets, stop-and-wait protocol, and 4 statutory verification gates.
6. [`context/progress-tracker.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/context/progress-tracker.md) — Current roadmap phase, completed work, open questions, and next steps.

---

## Operational Mandates
- **Update Progress Tracker**: Update [`context/progress-tracker.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/context/progress-tracker.md) after each meaningful implementation change.
- **Hierarchy of Truth**: [`docs/SSOT.md`](file:///home/jeipyyy/Documents/Projects/Municipal-Treasurers-Office-LGU/docs/SSOT.md) is the highest authority governing all mathematical, schema, and legal decisions.
- **Local-Only Git Rule**: AI agents **MUST NEVER** execute `git push` or push code to remote repositories.
- **Verification Gates**: Every task must pass `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, and `npm run build`.
