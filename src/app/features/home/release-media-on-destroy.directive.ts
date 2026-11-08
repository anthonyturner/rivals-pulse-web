import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/**
 * Stops a media element for good when Angular removes it. A removed element is paused, but a browser
 * keeps its download going until the source is dropped and the element loads again.
 */
@Directive({ selector: '[appReleaseMediaOnDestroy]' })
export class ReleaseMediaOnDestroyDirective {
  constructor() {
    const media = inject<ElementRef<HTMLMediaElement>>(ElementRef).nativeElement;

    inject(DestroyRef).onDestroy(() => {
      media.pause();
      media.removeAttribute('src');
      media.load();
    });
  }
}
