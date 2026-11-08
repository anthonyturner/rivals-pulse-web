import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KindChipComponent } from './kind-chip.component';

describe('KindChipComponent', () => {
  let fixture: ComponentFixture<KindChipComponent>;
  let element: HTMLElement;

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(KindChipComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('kind', 'secondary');
    fixture.componentRef.setInput('label', 'Roles');
    await settle();
  });

  it('is the pill itself: the chip class, its label and its kind, small and light by default', () => {
    expect(element.classList.contains('chip')).toBeTrue();
    expect(element.textContent?.trim()).toBe('Roles');
    expect(element.getAttribute('data-kind')).toBe('secondary');
    expect(element.getAttribute('data-size')).toBe('small');
    expect(element.hasAttribute('data-dark')).toBeFalse();
  });

  it('tints by the token of its kind', async () => {
    const background = () => getComputedStyle(element).backgroundColor;
    const probe = document.createElement('span');
    document.body.append(probe);

    for (const [kind, token] of [
      ['accent', '--accent-soft'],
      ['secondary', '--secondary-soft'],
      ['tertiary', '--tertiary-soft'],
    ] as const) {
      fixture.componentRef.setInput('kind', kind);
      await settle();
      probe.style.backgroundColor = `var(${token})`;

      expect(background()).withContext(kind).toBe(getComputedStyle(probe).backgroundColor);
    }

    probe.remove();
  });

  it('can be large, and dark for a dark panel', async () => {
    fixture.componentRef.setInput('size', 'large');
    fixture.componentRef.setInput('dark', true);
    await settle();

    expect(element.getAttribute('data-size')).toBe('large');
    expect(element.hasAttribute('data-dark')).toBeTrue();
  });
});
