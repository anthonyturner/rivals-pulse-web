import { DestroyRef, Directive, inject, Injectable, signal, TemplateRef } from '@angular/core';

/** The template a page has asked the shell's sidebar to show above its ads, if any. */
@Injectable({ providedIn: 'root' })
export class SidebarContent {
  private readonly current = signal<TemplateRef<unknown> | null>(null);

  readonly template = this.current.asReadonly();

  show(template: TemplateRef<unknown>): void {
    this.current.set(template);
  }

  /** Clears only the given template, so a page leaving after the next one arrived does not remove the next page's content. */
  clear(template: TemplateRef<unknown>): void {
    this.current.update((shown) => (shown === template ? null : shown));
  }
}

/**
 * Shows this template in the shell's sidebar for as long as the template's place in the page exists:
 * `<ng-template appSidebarContent>...</ng-template>`.
 */
@Directive({ selector: 'ng-template[appSidebarContent]' })
export class SidebarContentDirective {
  constructor() {
    const content = inject(SidebarContent);
    const template = inject(TemplateRef);

    content.show(template);
    inject(DestroyRef).onDestroy(() => content.clear(template));
  }
}
