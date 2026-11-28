import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NoticeComponent } from './notice.component';

@Component({
  imports: [NoticeComponent],
  template: '<app-notice><strong>Previous half-season.</strong> Showing Season 10.</app-notice>',
})
class HostComponent {}

describe('NoticeComponent', () => {
  it('shows its content in a note', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const note = (fixture.nativeElement as HTMLElement).querySelector('p[role="note"]');
    expect(note?.textContent?.trim()).toBe('Previous half-season. Showing Season 10.');
  });
});
