import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerAvatarComponent } from './player-avatar.component';

describe('PlayerAvatarComponent', () => {
  let fixture: ComponentFixture<PlayerAvatarComponent>;

  const render = async (name: string, avatarUrl: string | null): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [PlayerAvatarComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerAvatarComponent);
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('avatarUrl', avatarUrl);
    await fixture.whenStable();
  };

  const image = (): HTMLImageElement | null => fixture.nativeElement.querySelector('img');
  const initial = (): string | undefined => fixture.nativeElement.querySelector('.player-avatar--initial')?.textContent?.trim();

  it('shows the picture, with no alt text since the name is written beside it', async () => {
    await render('Aurora', 'https://content.overwolf.com/a.png');

    expect(image()?.getAttribute('src')).toBe('https://content.overwolf.com/a.png');
    expect(image()?.getAttribute('alt')).toBe('');
    expect(image()?.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('shows the first letter of the name when there is no avatar', async () => {
    await render('aurora', null);

    expect(image()).toBeNull();
    expect(initial()).toBe('A');
  });

  it('falls back to the first letter when the picture does not load', async () => {
    await render('Aurora', 'https://content.overwolf.com/gone.png');

    image()?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(image()).toBeNull();
    expect(initial()).toBe('A');
  });

  it('tries a new picture after a failed one', async () => {
    await render('Aurora', 'https://content.overwolf.com/gone.png');
    image()?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    fixture.componentRef.setInput('avatarUrl', 'https://content.overwolf.com/new.png');
    await fixture.whenStable();

    expect(image()?.getAttribute('src')).toBe('https://content.overwolf.com/new.png');
  });

  it('shows a question mark for a name with no letters to show', async () => {
    await render('   ', null);

    expect(initial()).toBe('?');
  });
});
