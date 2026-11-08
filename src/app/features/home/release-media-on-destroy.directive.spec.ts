import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ReleaseMediaOnDestroyDirective } from './release-media-on-destroy.directive';

@Component({
  imports: [ReleaseMediaOnDestroyDirective],
  template: `@if (shown()) {<video appReleaseMediaOnDestroy src="/clip.mp4"></video>}`,
})
class HostComponent {
  readonly shown = signal(true);
}

describe('ReleaseMediaOnDestroyDirective', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));

  it('pauses the media element, drops its source and loads it again once it is removed', async () => {
    const pause = spyOn(HTMLMediaElement.prototype, 'pause');
    const load = spyOn(HTMLMediaElement.prototype, 'load');
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const video = fixture.nativeElement.querySelector('video') as HTMLVideoElement;

    expect(video.hasAttribute('src')).toBeTrue();
    expect(pause).not.toHaveBeenCalled();

    fixture.componentInstance.shown.set(false);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('video')).toBeNull();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(video.hasAttribute('src')).toBeFalse();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
