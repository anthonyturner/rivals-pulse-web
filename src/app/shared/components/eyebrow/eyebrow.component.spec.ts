import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EyebrowComponent } from './eyebrow.component';

@Component({
  imports: [EyebrowComponent],
  template: '<app-eyebrow>Strategist guide</app-eyebrow><h1>Mantis</h1>',
})
class HostComponent {}

describe('EyebrowComponent', () => {
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows its text in a paragraph, not a heading', () => {
    const label = element.querySelector('app-eyebrow p') as HTMLElement;

    expect(label.textContent?.trim()).toBe('Strategist guide');
    expect(element.querySelectorAll('h1, h2, h3, h4, h5, h6').length).toBe(1);
  });

  it('is small text shown in the case it was written', () => {
    const style = getComputedStyle(element.querySelector('app-eyebrow p') as HTMLElement);

    expect(style.textTransform).toBe('none');
    expect(style.letterSpacing).toBe('normal');
    expect(parseFloat(style.fontSize)).toBeLessThan(14);
  });
});
