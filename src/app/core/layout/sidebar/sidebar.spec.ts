import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Sidebar } from './sidebar';
import { SidebarContentDirective } from './sidebar-content';

@Component({
  imports: [Sidebar, SidebarContentDirective],
  template: `
    @if (first()) {
      <ng-template appSidebarContent><p class="supplied">First</p></ng-template>
    }
    @if (second()) {
      <ng-template appSidebarContent><p class="supplied">Second</p></ng-template>
    }
    <app-sidebar />
  `,
})
class Host {
  readonly first = signal(false);
  readonly second = signal(false);
}

describe('Sidebar', () => {
  const render = async (first: boolean) => {
    const fixture = TestBed.createComponent(Host);

    fixture.componentInstance.first.set(first);
    await fixture.whenStable();

    return fixture;
  };
  const supplied = (element: HTMLElement) => element.querySelector('.supplied')?.textContent;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  it('shows only the ad when the page supplies nothing', async () => {
    const element: HTMLElement = (await render(false)).nativeElement;

    expect(element.querySelector('.sidebar__page-content')).toBeNull();
    expect(element.querySelector('aside[aria-label="Advertisement"] app-ad-slot')).not.toBeNull();
  });

  it('shows what the page supplies above the ad, outside the advertisement landmark', async () => {
    const element: HTMLElement = (await render(true)).nativeElement;
    const content = element.querySelector('.sidebar__page-content') as HTMLElement;
    const ads = element.querySelector('.sidebar__ads') as HTMLElement;

    expect(supplied(content)).toBe('First');
    expect(content.compareDocumentPosition(ads) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ads.querySelector('.supplied')).toBeNull();
  });

  it('removes the content when the page stops supplying it', async () => {
    const fixture = await render(true);

    fixture.componentInstance.first.set(false);
    await fixture.whenStable();

    expect(supplied(fixture.nativeElement)).toBeUndefined();
  });

  it('keeps the newer content when older content leaves after it arrived', async () => {
    const fixture = await render(true);

    fixture.componentInstance.second.set(true);
    await fixture.whenStable();
    fixture.componentInstance.first.set(false);
    await fixture.whenStable();

    expect(supplied(fixture.nativeElement)).toBe('Second');
  });
});
