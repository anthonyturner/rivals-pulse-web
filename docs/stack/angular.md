# Angular architecture

Read this file before writing Angular code in Rivals Pulse Coach. It defines the
structural conventions components and services follow. It does not list where
things live in the codebase: infer that from the repository tree, so this file
cannot drift out of step with it.

These conventions add to [../rules.md](../rules.md) and
[typescript.md](typescript.md); they do not replace them. Component and
template rules live in [ui-components.md](ui-components.md).

## The mandatory part

These three are rules, not preferences:

- **Every component uses `ChangeDetectionStrategy.OnPush`.** *Change detection*
  is Angular re-checking a component's template to see whether the screen needs
  updating. The default strategy checks every component on every pass. OnPush
  checks a component only when one of its inputs changes, an event fires inside
  it, or a signal its template reads changes, which is far cheaper and makes
  data flow explicit.
- **Every subscription is torn down with `takeUntilDestroyed()`** (or an
  equivalent that ends it when its owner is destroyed). A subscription that
  outlives its component keeps running, keeps the component in memory, and
  keeps acting on a screen that is gone.
- **Templates follow Template reactivity** in
  [ui-components.md](ui-components.md), which is the single definition of that
  requirement. It is deliberately not restated here.

## Components

- **Keep smart and presentational components apart where practical.** A
  *smart* (container) component talks to services and owns state. A
  *presentational* component receives data through inputs, reports actions
  through outputs, and knows nothing about where the data came from, which
  makes it easy to reuse and to test.
- **Keep component APIs typed and explicit.** Every input and output has a real
  type.
- **Use component-scoped style files**, one per component.

## Services

- **Provide singleton services with `providedIn: 'root'`** when one shared
  instance is what you want. Do not also list the same service in a
  component's `providers`, which silently creates a second instance.
- **Expose reactive state as a signal or an Observable**, not as a plain field
  callers have to poll. A *signal* is Angular's value-that-notifies-readers; an
  *Observable* is an RxJS stream. Prefer signals for state a template reads,
  and Observables for streams of events over time; `toSignal()` bridges the two.
- **Isolate side effects** (network calls, storage, timers) in services, and
  log them through the project's logger (see [typescript.md](typescript.md)).
- **Before adding a service, check whether one already owns the
  responsibility**, and extend it rather than writing a second implementation.

## Types and structure

- **Put shared interfaces in dedicated `*.types.ts` files**, so a type has one
  home that both sides import.
- **Keep business logic in services or core layers, not in templates.** A
  template decides how things look, not what they mean.
- **Favour composition over large monolithic components and services.** Several
  small pieces, each with one job, are easier to change than one piece that
  does everything.

## Platform and third-party APIs

A *platform API* is anything the app calls that it does not own: a browser or
host-environment API, a vendor SDK, a remote service.

- **Keep each one behind a service boundary** (an *adapter*). Components and
  other services talk to the adapter in the project's own types; only the
  adapter knows the foreign API's shape. When that API changes, one file
  changes.
- **Treat what comes back as untrusted.** Validate and guard payloads before
  using them; events from outside the app can be noisy, malformed or
  duplicated.
- **Behave gracefully when data is missing or late.** Show a sensible empty or
  loading state rather than failing.
- **Handle cross-window and event messaging defensively**: check the message
  shape and the sender before acting on it.
