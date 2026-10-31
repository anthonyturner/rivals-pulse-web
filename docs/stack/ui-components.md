# UI components

Read this file before building or changing an Angular component in
Rivals Pulse Coach. [angular.md](angular.md) covers architecture; this file
covers components, templates and accessibility.

## Reuse before building

Look for an existing shared component before creating a new one. Reuse or
extend it rather than duplicating its markup or logic. Two copies of one
component drift apart, and every fix has to be made twice.

## Component conventions

- **Standalone components** (`standalone: true`, the default in current
  Angular), using the project's selector prefix, with
  `ChangeDetectionStrategy.OnPush`.
- **One folder per component**, named in kebab-case, holding its own
  `.component.ts`, `.html` and style file. A nested sub-component lives in a
  child folder.
- **Use the signal-based `input()` and `output()` APIs for new components.**
  Existing components using the `@Input()` and `@Output()` decorators are
  legacy and do not need migrating just because you touched them, with one
  exception: a decorator `@Input()` read from inside a `computed()` is a defect,
  not acceptable legacy. See Template reactivity below.

## Template reactivity

This section is the single definition of template reactivity for the project.
[angular.md](angular.md) makes it mandatory and points here rather than
repeating it.

Aim for reactivity. What a template renders comes from signals, `computed()`
or inputs, never from work the template performs itself. A template expression
is re-evaluated on **every** change-detection pass, and Angular cannot know
whether the answer changed until after it has paid for it.

- **No method or getter calls in templates**, with exactly two exceptions:
  - **Event handlers.** `(click)="onSelect($event, item)"` runs when the event
    fires, not on every check.
  - **Cheap pure functions that return a primitive**: no allocation, no service
    lookup, and a result that compares `===` to last time.
- **A getter is a method.** `get total()` is re-run on every check exactly like
  `total()`. The property syntax hides the call; it does not cache the result.
- **Derive with `computed()`.** It caches its result and recomputes only when a
  signal it read actually changed, so the work happens once per change instead
  of once per check, and the reference stays stable in between.
- **Never return a fresh object or array from a template expression.** Angular
  compares results with `===`, so a new reference on every check defeats that
  comparison and marks any OnPush child dirty on every pass. Watch for `?? []`
  and for inline `context: { ... }` objects on `*ngTemplateOutlet`.
- **Collapse per-row work into one `computed()`** that returns ready-to-render
  view models, so the template only reads properties.
- **Keep fast-changing state out of those view models.** A value on its own
  clock, such as a countdown or an elapsed time, belongs in its own signal read
  directly in the template. Fold it into the view model and every tick rebuilds
  every row.
- **A `computed()` is only as correct as its inputs are reactive.** Pointed at a
  plain `@Input()`, a mutable `Map` or an ordinary class field, it caches a
  stale answer and reports no error. Make the source reactive first, check the
  component still behaves while it uses the default change detection, and
  switch to OnPush last.

A method call in a template is never stale, which is why code shaped that way
usually works. It is the cost, not the correctness, that rules it out.

## Accessibility

Meet [WCAG 2.1 AA](https://www.w3.org/TR/WCAG21/), the widely used web
accessibility standard:

- Every interactive element works from the keyboard.
- Focus is always visible.
- Custom interactive elements have the right ARIA role and an accessible label.
  (ARIA attributes tell assistive technology, such as screen readers, what an
  element is.)
- Text and controls have sufficient colour contrast against their background.

## Styling (if the project uses them)

This section applies only if the project has adopted these conventions. Say so
in `docs/tech-stack.md`; if it has not, skip this section.

- **BEM class names** (`block__element--modifier`), so a class name says which
  component it belongs to and what it styles.
- **Theme CSS variables** for colours and similar values, instead of hard-coded
  values, so a theme change is one edit.
- **Bootstrap utility classes** for layout and spacing, instead of hand-written
  one-off rules.

Whatever the styling approach, keep styles component-scoped: no global style
overrides, and avoid `::ng-deep`, which leaks a component's styles into every
component below it.
