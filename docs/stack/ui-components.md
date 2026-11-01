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

## Type scale

This section always applies, whatever the styling conventions above.

Heading sizes come from four tokens in `src/styles.css`. No heading is larger
than its role's token; a heading at or below `--type-h3` may keep a smaller
literal size. Choose the token by the heading's visual role, not its tag (many
cards use an `<h2>`).

| Token | At 1366px | Use for |
| --- | --- | --- |
| `--type-hero` | 60px | The home hero headline only. |
| `--type-page-title` | 40px | The page `<h1>`, including the shared `app-page-header`. |
| `--type-h2` | 32px | A section heading that opens a band or a page section. |
| `--type-h3` | 18px | A card, panel or list-item heading. |

- Set only `font-size: var(--type-...)`. Weight, line height and letter spacing
  stay with the component.
- A new heading takes the nearest token; do not make a heading larger than its
  role. Changing a size for the whole site is one edit in `styles.css`.
- Numeric readouts (stat figures, tier letters, step numerals) and body text are
  not headings and keep their own sizes.

Three more tokens size text that is not a heading. Body text is 1rem.

| Token | At 1366px | Use for |
| --- | --- | --- |
| `--type-title` | 24px | The name of a selected item in a panel (the selected hero's name). |
| `--type-small` | 14px | Card names, ledes, summaries, chips and buttons. |
| `--type-caption` | 12px | Role pills, labels, source links. No text is smaller. |

## Page containers

This section always applies, whatever the styling conventions above. It is a
layout utility, not a global style override: the classes set a width and side
margins and nothing visual, so they do not restyle anything inside them.

A page's content width comes from the `.page-container` class and three tokens
in `src/styles.css`, not from a width written in the page's own CSS.

| Class | Token | Content width at 1366px | Use for |
| --- | --- | --- | --- |
| `page-container page-container--narrow` | `--container-narrow` | 768px | Reading pages: prose and FAQ-style sections. |
| `page-container` | `--container` | 1120px | A single guide or article. |
| `page-container page-container--wide` | `--container-wide` | 1220px | Listings, tools and dashboards. |

- Put the class on the page's outermost wrapper element in the template. The
  width is the *content* width: the viewport minus `--page-gutter` on each
  side (32px, falling to `--mobile-page-gutter` at 560px and below), capped at
  the token.
- The wrapper takes no side padding, width or horizontal margin of its own, and
  its children do not re-apply a page width or gutter.
  Vertical padding stays with the component (`padding-block`).
- Full width is simply not using the class, for example the home page's
  full-bleed bands. Do not wrap `<router-outlet>` in the app shell: a page
  chooses its own width.
- A new width is a new token and a new modifier, not a literal `min(...)` or
  `max-width` in a component.

## Sidebar and ad slots

Every page except the home page (whose route sets `data: ROUTE_WITHOUT_SIDEBAR`)
gets a sidebar from the app shell, so a page does not add one itself. From
1280px up it sits beside the page; below that it stacks under it.

- On a page with the sidebar, the page container's `100%` is the page column,
  not the viewport, so its content is the viewport minus the sidebar column
  (about 332px) minus the gutters. A page whose layout needs more than that at
  1280px is a page that needs fixing, not a reason to move the breakpoint.
- An ad is an `app-ad-slot` with a size id from `AD_SLOT_SIZES`. The slot
  reserves that size in CSS and knows no ad network; what fills it is the
  `AdProvider` behind the `AD_PROVIDER` token (the house ad by default). A
  provider that creates ad units or runs other browser-only code sets
  `browserOnly: true`, and the slot then renders it only after the page has
  rendered in the browser, never on the server. The ad network's own loader is
  site-wide, in `index.html`, not in a provider.
- **AdSense.** `provideAdSense()` in `app.config.ts` makes the AdSense provider the
  `AD_PROVIDER` once an ad unit id is set, and leaves the house ad otherwise. The ad
  unit id and the publisher id are set in one place,
  `shared/components/ad-slot/adsense/adsense.config.ts` (`slotIds.rectangle` for the
  sidebar). The provider shows an AdSense unit only when that id is set and Google's
  own consent message (Privacy & messaging, served by the loader) reports the visitor
  agreed or that no consent is needed; the answer is read by `GoogleConsentService`
  in `core/consent/`. In every other case the slot shows the house ad. It creates a
  fresh `<ins class="adsbygoogle">` for each new page path, because the sidebar stays
  mounted between pages. Do not add a second consent banner; the footer's "Privacy and
  cookie settings" button reopens Google's message and shows only where it applies.
- **Affiliate links.** Put `app-affiliate-disclosure` next to any affiliate link. There
  are none today.
