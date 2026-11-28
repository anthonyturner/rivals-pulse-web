import { DestroyRef, inject, Injectable, linkedSignal, computed, signal, type Signal } from '@angular/core';

/**
 * What a page knows about its own main content. `loading` is "no answer yet": the page keeps the
 * last settled answer, and counts as thin until it has had one.
 */
export type ContentState = 'loading' | 'thin' | 'ready';

/**
 * Whether the page on screen has too little to read to carry an ad or to be indexed: its data is
 * missing, below the minimum, or could not be loaded, or it is the not-found page. The shell hides
 * the sidebar ads while `thin()` is true and `PageMetaTitleStrategy` asks search engines not to index
 * the page. Pages do not talk to either: they call `reportContentState`.
 *
 * Reporting is signal-based, so the verdict is the same on the server, where the page is rendered
 * once its data has arrived, and in the browser, where it can change later.
 */
@Injectable({ providedIn: 'root' })
export class ThinContent {
  private readonly reporters = signal<readonly Signal<boolean>[]>([]);

  /**
   * True when the page reports content and all of it is thin. A page with several data sections, such
   * as a community tab, is thin only when every section is; a page that reports nothing is never thin.
   */
  readonly thin = computed(() => {
    const all = this.reporters();

    return all.length > 0 && all.every((isThin) => isThin());
  });

  /** Registers a page's verdict until `destroyRef` is destroyed. Call `reportContentState` instead. */
  report(state: () => ContentState, destroyRef: DestroyRef): void {
    // A page reloading for a new filter keeps its last verdict, so the ad does not leave and come
    // back: a slot that is rebuilt on the same page asks the ad network for a second ad.
    const isThin = linkedSignal<ContentState, boolean>({
      source: stateOnceBound(state),
      computation: (next, previous) => (next === 'loading' ? (previous?.value ?? true) : next === 'thin'),
    });

    this.reporters.update((all) => [...all, isThin]);
    destroyRef.onDestroy(() => this.reporters.update((all) => all.filter((entry) => entry !== isThin)));
  }
}

/**
 * A component is created, and its reporter read, before its first change detection binds its inputs:
 * the router creates a routed page and then updates the title before anything is rendered. A reporter
 * that reads a required input in that window throws NG0950, which only means the page has not been
 * given its answer yet, so it is `loading`. The input signal notifies the reporter once it is bound.
 */
function stateOnceBound(state: () => ContentState): () => ContentState {
  return () => {
    try {
      return state();
    } catch (error) {
      if (isRequiredInputUnset(error)) {
        return 'loading';
      }

      throw error;
    }
  };
}

/** Angular's NG0950 `RuntimeError`; its numeric code is the only public trace of it. */
function isRequiredInputUnset(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === -950;
}

/**
 * Tells the shell how much a page has to read. Call it once from a component's field initialiser or
 * constructor, with a function that reads the page's signals. A page with a minimum of data to meet
 * returns `thin` while it is below it.
 */
export function reportContentState(state: () => ContentState): void {
  inject(ThinContent).report(state, inject(DestroyRef));
}

/** The state of a page that loads its data: no answer while `loading`, otherwise thin unless `ready`. */
export function contentState(loading: boolean, ready: boolean): ContentState {
  return loading ? 'loading' : ready ? 'ready' : 'thin';
}
