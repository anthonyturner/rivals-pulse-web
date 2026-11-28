import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Directive, ElementRef, PLATFORM_ID, inject } from '@angular/core';

/**
 * Stops a media element for good when Angular removes it. A removed element is paused, but a browser
 * keeps its download going until the source is dropped and the element loads again. The server's
 * stand-in elements have no playback methods and nothing to stop.
 */
@Directive({ selector: '[appReleaseMediaOnDestroy]' })
export class ReleaseMediaOnDestroyDirective {
  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    const media = inject<ElementRef<HTMLMediaElement>>(ElementRef).nativeElement;

    inject(DestroyRef).onDestroy(() => {
      media.pause();
      media.removeAttribute('src');
      media.load();
    });
  }
}
