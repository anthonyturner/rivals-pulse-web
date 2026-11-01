import { Component, input, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdSlotComponent } from './ad-slot.component';
import { AD_PROVIDER, AD_SLOT_SIZES, AdProvider, AdSlotSize, HOUSE_AD_PROVIDER } from './ad-slot.types';

@Component({ selector: 'app-test-ad', template: `<p class="test-ad">{{ slot().width }} wide</p>` })
class TestAdComponent {
  readonly slot = input.required<AdSlotSize>();
}

@Component({ selector: 'app-empty-ad', template: '' })
class EmptyAdComponent {
  readonly slot = input.required<AdSlotSize>();
}

@Component({
  selector: 'app-test-page',
  imports: [AdSlotComponent],
  template: `
    <app-ad-slot slot="rectangle" />
    <p class="after-slot">The page content that must not move.</p>
  `,
})
class TestPageComponent {}

describe('AdSlotComponent', () => {
  async function render(provider?: AdProvider): Promise<ComponentFixture<TestPageComponent>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TestPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        ...(provider ? [{ provide: AD_PROVIDER, useValue: provider }] : []),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestPageComponent);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    return fixture;
  }

  function measure(fixture: ComponentFixture<TestPageComponent>): { slot: DOMRect; after: DOMRect } {
    const page = fixture.nativeElement as HTMLElement;

    return {
      slot: (page.querySelector('app-ad-slot') as HTMLElement).getBoundingClientRect(),
      after: (page.querySelector('.after-slot') as HTMLElement).getBoundingClientRect(),
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('reserves the size of its slot id', async () => {
    const { slot } = measure(await render());

    expect(slot.width).toBe(AD_SLOT_SIZES.rectangle.width);
    expect(slot.height).toBe(AD_SLOT_SIZES.rectangle.height);
  });

  it('keeps the page content where it is whatever the provider draws, or nothing at all', async () => {
    const providers: AdProvider[] = [
      HOUSE_AD_PROVIDER,
      { id: 'small', component: TestAdComponent, browserOnly: false },
      { id: 'empty', component: EmptyAdComponent, browserOnly: false },
    ];
    const measured = [];

    for (const provider of providers) {
      measured.push(measure(await render(provider)));
    }

    for (const { slot, after } of measured) {
      expect(slot.height).toBe(AD_SLOT_SIZES.rectangle.height);
      expect(after.top).toBe(measured[0].after.top);
    }
  });

  it('hands the provider the slot size, and shows which provider is behind it', async () => {
    const fixture = await render({ id: 'small', component: TestAdComponent, browserOnly: false });
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('.test-ad')?.textContent).toBe('300 wide');
    expect(page.querySelector('app-ad-slot')?.getAttribute('data-provider')).toBe('small');
  });

  it('shows a browser-only provider once the page has rendered in the browser', async () => {
    const fixture = await render({ id: 'late', component: TestAdComponent, browserOnly: true });

    expect((fixture.nativeElement as HTMLElement).querySelector('.test-ad')).not.toBeNull();
  });
});
