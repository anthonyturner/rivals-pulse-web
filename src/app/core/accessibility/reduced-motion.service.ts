import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, afterNextRender, inject, signal } from '@angular/core';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the visitor's device asks for less motion, kept current if they change it while the page
 * is open. It is false on the server and until the first render in the browser, because the server
 * cannot know and hydration has to see the same markup.
 */
@Injectable({ providedIn: 'root' })
export class ReducedMotionService {
  private readonly current = signal(false);

  readonly reduced = this.current.asReadonly();

  constructor() {
    const view = inject(DOCUMENT).defaultView;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const query = view?.matchMedia(REDUCED_MOTION_QUERY);
      if (!query) return;
      const update = (): void => this.current.set(query.matches);
      update();
      query.addEventListener('change', update);
      destroyRef.onDestroy(() => query.removeEventListener('change', update));
    });
  }
}
