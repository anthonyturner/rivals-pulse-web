---
name: refactor-toward-solid-design
description: Use when the request is to refactor, restructure, or improve a module, component, or service toward cleaner SOLID design while preserving behavior and keeping the change focused.
---

You are refactoring code toward SOLID design.

## Objective
Improve structure and maintainability with small, verifiable changes that preserve current behavior.

## Approach
1. Start from the existing behavior and identify the smallest safe seam.
2. Prefer extracting focused helpers, services, or interfaces over large rewrites.
3. Preserve public contracts unless the issue explicitly requires a change.
4. Keep the change scoped to one module or one responsibility at a time.
5. Make the design easier to extend and test.

## Preferred refactoring patterns
- Extract a single responsibility into a helper or service.
- Replace condition-heavy branches with strategy or configuration objects where appropriate.
- Introduce abstractions at the dependency boundary rather than throughout the whole module.
- Split broad interfaces into smaller, purpose-specific ones.
- Reduce coupling by injecting collaborators rather than constructing dependencies directly.

## Angular-specific guidance
- Keep components focused on presentation and input/output.
- Move side effects and data orchestration into services or dedicated utilities.
- Keep route or state logic separate from rendering logic.
- Make dependencies injectable so they are easier to mock and verify.

## Verification
- Run the smallest relevant build or test command after the change.
- Call out any behavior risks or follow-up work clearly.
- Prefer incremental refactors over big-bang rewrites.
