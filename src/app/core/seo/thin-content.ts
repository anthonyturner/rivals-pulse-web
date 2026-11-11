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
  private readonly requestFailed = signal(false);

  /**
   * True when the page reports content and all of it is thin. A page with several data sections, such
   * as a community tab, is thin only when every section is. A page that reports nothing is not thin,
   * unless a request failed while the server rendered it: it then shows an error state, not content.
   */
  readonly thin = computed(() => {
    const all = this.reporters();

    return all.length > 0 ? all.every((isThin) => isThin()) : this.requestFailed();
  });

  /** Records that a request failed during the server render, so a page that reports nothing counts as thin. */
  reportFailedRequest(): void {
    this.requestFailed.set(true);
  }

  /** Registers a page's verdict until `destroyRef` is destroyed. Call `reportContentState` instead. */
  report(state: () => ContentState, destroyRef: DestroyRef): void {
    // A page reloading for a new filter keeps its last verdict, so the ad does not leave and come
    // back: a slot that is rebuilt on the same page asks the ad network for a second ad.
    const isThin = linkedSignal<ContentState, boolean>({
      source: state,
      computation: (next, previous) => (next === 'loading' ? (previous?.value ?? true) : next === 'thin'),
    });

    this.reporters.update((all) => [...all, isThin]);
    destroyRef.onDestroy(() => this.reporters.update((all) => all.filter((entry) => entry !== isThin)));
  }
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
