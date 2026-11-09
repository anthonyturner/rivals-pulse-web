import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageHeaderComponent } from './page-header.component';

@Component({
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="Hero stats">
      <p lede class="first">See the <a href="/tier-list">tier list</a>.</p>
      <p lede class="second">Counted since May.</p>
    </app-page-header>
  `,
})
class LedeHostComponent {}

describe('PageHeaderComponent', () => {
  let fixture: ComponentFixture<PageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('title', 'Choose a guide');
    fixture.componentRef.setInput('description', 'Open a focused coaching guide.');
    fixture.detectChanges();
  });

  it('renders the shared page heading content', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Choose a guide');
    expect(element.querySelector('.description')?.textContent).toContain(
      'Open a focused coaching guide.',
    );
  });

  it('supports a title without a description', () => {
    const titleOnly = TestBed.createComponent(PageHeaderComponent);
    titleOnly.componentRef.setInput('title', 'Community totals');
    titleOnly.detectChanges();
    expect(titleOnly.nativeElement.querySelector('h1')?.textContent).toBe('Community totals');
    expect(titleOnly.nativeElement.querySelector('p')).toBeNull();
  });

  it('removes an empty description and restores it when the input changes', () => {
    fixture.componentRef.setInput('description', '   ');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p')).toBeNull();
    fixture.componentRef.setInput('description', 'Choose your next lesson.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('p')?.textContent).toBe('Choose your next lesson.');
  });

  it('starts with the heading, with no label above it', () => {
    const header = (fixture.nativeElement as HTMLElement).querySelector('header') as HTMLElement;

    expect(header.firstElementChild?.tagName).toBe('H1');
    expect(header.textContent?.trim().startsWith('Choose a guide')).toBeTrue();
  });

  it('shows no description block when nothing is projected', () => {
    const projected = (fixture.nativeElement as HTMLElement).querySelector(
      '.description--projected',
    ) as HTMLElement;

    expect(projected.childElementCount).toBe(0);
    expect(getComputedStyle(projected).display).toBe('none');
  });

  it('renders a projected lede, links included, under the title', () => {
    const host = TestBed.createComponent(LedeHostComponent);
    host.detectChanges();
    const element = host.nativeElement as HTMLElement;
    const projected = element.querySelector('.description--projected') as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toBe('Hero stats');
    expect(projected.querySelector('.first a')?.getAttribute('href')).toBe('/tier-list');
    expect(Array.from(projected.querySelectorAll('p')).map((p) => p.textContent)).toEqual([
      'See the tier list.',
      'Counted since May.',
    ]);
    expect(getComputedStyle(projected).display).not.toBe('none');
  });
});
