import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GuideCardComponent } from './guide-card.component';

@Component({
  imports: [GuideCardComponent],
  template: `
    <app-guide-card
      title="Captain America"
      [route]="['/hero-guides', 'captain-america']"
      imageUrl="/images/heroes/captain-america.png"
      caption="Vanguard"
      blurb="Stage around the enemy."
      [headingLevel]="level"
    />
  `,
})
class HostComponent {
  level: 2 | 3 | null = null;
}

describe('GuideCardComponent', () => {
  function render(level: 2 | 3 | null = null): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.level = level;
    fixture.detectChanges();

    return fixture.nativeElement;
  }

  it('is one link, named by the title alone', () => {
    const links = render().querySelectorAll('a');

    expect(links.length).toBe(1);
    expect(links[0].textContent?.trim()).toBe('Captain America');
    expect(links[0].getAttribute('href')).toBe('/hero-guides/captain-america');
  });

  it('hides its decorative portrait from assistive technology', () => {
    expect(render().querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('is not a heading unless the page asks for one', () => {
    expect(render().querySelector('h2, h3')).toBeNull();
  });

  it('puts the link inside the heading level the page asks for', () => {
    expect(render(3).querySelector('h3 > a')?.textContent?.trim()).toBe('Captain America');
  });

  it('shows the caption and the blurb', () => {
    const text = render().textContent ?? '';

    expect(text).toContain('Vanguard');
    expect(text).toContain('Stage around the enemy.');
  });
});
