# UI components

Read this file before building or changing an Angular component in
RivalsPulse. [angular.md](angular.md) covers architecture; this file
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

## Colour and themes

This section always applies, whatever the styling conventions above. The site has two themes, dark (the base) and light, and both use the desktop app's Aurora palette with the same values as the app's `styles-desktop-theme.scss`. Dark shows when there is no saved choice and no device preference.

- **Palette tokens (`--aurora-*`) live in `src/styles.css` and nowhere else.** The dark values are the base `:root` block; `:root[data-theme='light']` overrides what differs and also sets `color-scheme`, so scrollbars and form controls match. A component never reads `--aurora-*`.
- **Components use role tokens only.** A role token names a job, never a hue. A `-strong` or `-ink` suffix means the role used as text, `-soft` its tint behind content, `-line` its border.

| Job | Token |
| --- | --- |
| Page, header and card surfaces | `--bg`, `--bg-elevated`, `--bg-panel`, `--bg-panel-soft`, `--surface`, `--surface-2` |
| Text | `--text`, `--text-soft` (the same as `--text`), `--text-muted`, `--text-faint` (graphics only, below text contrast) |
| Edges | `--border` (a divider), `--border-strong` (a panel edge), `--control-border` (the edge of an input or button), `--accent-line` (a selected edge) |
| Links and focus | `--link` (always underlined), `--focus` (rings and outlines), `--focus-ring` (a soft halo) |
| Primary action and brand | `--accent` (fill), `--accent-strong` (as text), `--accent-soft` (tint), `--accent-ink` (text drawn on an accent fill) |
| Supporting emphasis | `--secondary`, `--tertiary`, each with `-ink` and `-soft` |
| Match outcome, and nothing else | `--win`, `--loss`, each with `-ink` and `-soft` |
| Warnings and errors | `--danger`, `--danger-ink`, `--danger-soft` |
| Hero roles | `--role-vanguard`, `--role-duelist`, `--role-strategist` |
| Shadows | `--shadow-color`, `--shadow-soft` |
| Bands that stay dark in both themes (the home hero, the overlay and news bands, the house ad) | `--ink`, `--ink-raised`, `--ink-line`, `--ink-control-border`, `--on-ink`, `--on-ink-muted`, `--ink-accent`, `--on-ink-accent`, `--ink-focus` |

- **A component writes no colour literal**: no hex, `rgb()` or `hsl()`. A see-through version of a token is `color-mix(in srgb, var(--token) 40%, transparent)`. Where the site needs a role the palette lacks, derive it from a palette value and say so in the pull request; do not add a new hue.
- **The only literals left in component styles are data, not theme**: the six tier colours in `tier-rows.component.css`. `npm run test:theme` fails on any other literal in `src/app/**/*.css`, on a component reading `--aurora-*`, and on a `var(--x)` that nothing declares.
- **Contrast is tested, not eyeballed.** `npm run test:theme` (CI runs it with the other script tests) measures every text, control-edge and focus pair in both themes against WCAG 2.1 AA, and holds the `--ink-*` tokens equal to the dark palette. After changing a value in `styles.css`, run it.
- **Pair text with its own kind of token.** Text on `--accent`, `--win` or `--loss` uses `--accent-ink`; coloured text on a plain surface uses an `-ink` or `-strong` token, never the fill. `--text-faint` is never text.
- **Focus** is `var(--focus)` in both themes; the global `:focus-visible` rule in `styles.css` sets a 2px outline with it. A component that draws its own ring uses the same token.
- **The choice** is owned by `ThemeService` (`core/theme`), which sets `data-theme` on `<html>` and saves it in `localStorage` under `rp.web-theme`. An inline script in `src/index.html` applies the same rule before the first paint, so the page does not flash the other theme; `scripts/theme-inline-script.test.mjs` keeps the two in step. No Content Security Policy is set today (not in `vercel.json` or `server.ts`); one that blocks inline scripts would need a nonce or hash for that script. The toggle is `app-theme-toggle`, inside the header navigation.
- **An image that assumes a light page**, such as an all-black icon, uses `var(--icon-filter)`.

## Colour and themes

This section always applies, whatever the styling conventions above. The site has two themes, dark (the base) and light, and both use the desktop app's Aurora palette with the same values as the app's . Dark is what shows with no saved choice and no device preference.

- **Palette tokens () live in  and nowhere else.** The dark values are the base  block;  overrides what differs and also sets , so scrollbars and form controls match. A component never reads .
- **Components use role tokens only**, which name a job and never a hue. A role is a text colour, a surface, a tint or an edge;  and  suffixes mean the role used as text,  means its tint behind content,  its border.

| Job | Token |
| --- | --- |
| Page, header and card surfaces | , , , , ,  |
| Text | ,  (the same as ), ,  (graphics only, below text contrast) |
| Edges |  (a divider),  (a panel edge),  (the edge of an input or button),  (a selected edge) |
| Links and focus |  (always underlined),  (rings and outlines),  (a soft halo) |
| Primary action and brand |  (fill),  (as text),  (tint),  (text drawn on an accent fill) |
| Supporting emphasis | , , each with  and  |
| Match outcome, and nothing else | , , each with  and  |
| Warnings and errors | , ,  |
| Hero roles | , ,  |
| Shadows | ,  |
| Bands that stay dark in both themes (the home hero, the overlay and news bands, the house ad) | , , , , , , , ,  |

- **A new component writes no colour literal**: no hex,  or . A translucent version of a token is . Where the site needs a role the palette lacks, derive it from a palette value and say so in the pull request; do not add a new hue.
- **The only literals left in component styles are data, not theme**: the six tier colours in .  fails on any other literal in , on a component reading , and on a  that nothing declares.
- **Contrast is tested, not eyeballed.**  (run in CI with the other script tests) measures every text, control-edge and focus pair in both themes against WCAG 2.1 AA, and holds the  tokens equal to the dark palette. After changing a value in , run it.
- **Pair text with its own kind of token.** Text on ,  or  uses ; coloured text on a plain surface uses an  or  token, not the fill.  is never text.
- **Focus** is  in both themes (the global  rule in  sets 2px). A component that draws its own ring uses the same token.
- **The choice** is owned by  (), which sets  on  and saves it in  under . An inline script in  applies the same rule before the first paint, so there is no flash;  keeps the two in step. No Content Security Policy is set today (not in  or ); one that blocks inline scripts needs a nonce or hash for that script. The toggle is  in the header navigation.
- **Images that assume a light page** (an all-black icon, for example) use .

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

## Page landmark

The app shell renders the one `<main id="main-content" tabindex="-1">` around
`<router-outlet>`, and the skip link and the focus move after a page change
both target it. A page never renders its own `<main>`: its root is a `div`, or
a `section` with an `aria-label` when the region needs a name. A page with
several regions labels each one.

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
