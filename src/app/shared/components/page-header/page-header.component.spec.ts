import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageHeaderComponent } from './page-header.component';

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

  it('starts with the heading, with no label above it', () => {
    const header = (fixture.nativeElement as HTMLElement).querySelector('header') as HTMLElement;

    expect(header.firstElementChild?.tagName).toBe('H1');
    expect(header.textContent?.trim().startsWith('Choose a guide')).toBeTrue();
  });
});
