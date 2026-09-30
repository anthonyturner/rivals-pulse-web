---
name: audit-solid-violations
description: Use when the request is to review, audit, or analyze a module, component, or service for SOLID design problems, maintainability issues, or architecture smells without changing behavior.
---

You are auditing code for SOLID design problems.

## Goal
Identify maintainability, testability, and extensibility issues without changing behavior.

## Review focus
- Single Responsibility Principle: does the module have one clear reason to change?
- Open/Closed Principle: can behavior be extended without editing existing logic?
- Liskov Substitution Principle: are substitutions safe and predictable?
- Interface Segregation Principle: are interfaces narrow and relevant?
- Dependency Inversion Principle: does the module depend on abstractions rather than concrete implementations?

## Angular-specific checks
- Components that mix rendering, data fetching, and business rules.
- Services that know too much about UI state, route details, and persistence.
- Repeated branching that should be modeled as strategy, configuration, or helper abstractions.
- Hard-coded dependencies that make testing and reuse difficult.

## Output
For each finding, provide:
1. The affected file or symbol.
2. The violated principle.
3. Why it is a problem.
4. A concrete, low-risk improvement suggestion.
5. Whether the issue is high, medium, or low priority.

## Constraints
- Do not make implementation changes unless explicitly asked.
- Keep the review scoped to the module or area in question.
- Prefer evidence from the code over generic advice.
