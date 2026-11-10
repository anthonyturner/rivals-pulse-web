import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { type ContentState, contentState, reportContentState, ThinContent } from './thin-content';

@Component({ template: '' })
class ReportingPage {
  readonly state = signal<ContentState>('loading');

  constructor() {
    reportContentState(() => this.state());
  }
}

describe('ThinContent', () => {
  let thin: ThinContent;

  const open = (state: ContentState): ComponentFixture<ReportingPage> => {
    const fixture = TestBed.createComponent(ReportingPage);

    fixture.componentInstance.state.set(state);
    return fixture;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    thin = TestBed.inject(ThinContent);
  });

  it('is not thin on a page that reports nothing', () => {
    expect(thin.thin()).toBeFalse();
  });

  it('is thin while the page has no answer yet, and when it is below its minimum', () => {
    const page = open('loading');

    expect(thin.thin()).toBeTrue();

    page.componentInstance.state.set('thin');

    expect(thin.thin()).toBeTrue();
  });

  it('is not thin once the page has enough, and is thin again if the numbers fall below the minimum', () => {
    const page = open('ready');

    expect(thin.thin()).toBeFalse();

    page.componentInstance.state.set('thin');

    expect(thin.thin()).toBeTrue();
  });

  it('keeps the last answer while the page loads again, so an ad is not taken away and put back', () => {
    const page = open('ready');

    expect(thin.thin()).toBeFalse();

    page.componentInstance.state.set('loading');

    expect(thin.thin()).toBeFalse();

    page.componentInstance.state.set('thin');

    expect(thin.thin()).toBeTrue();

    page.componentInstance.state.set('loading');

    expect(thin.thin()).toBeTrue();
  });

  it('is thin only when every section on the page is', () => {
    const full = open('ready');
    const empty = open('thin');

    expect(thin.thin()).toBeFalse();

    full.destroy();

    expect(thin.thin()).toBeTrue();
    empty.destroy();
  });

  it('stops counting a page once it is gone', () => {
    open('thin').destroy();

    expect(thin.thin()).toBeFalse();
  });
});

describe('contentState', () => {
  it('is loading until there is an answer, then ready or thin', () => {
    expect(contentState(true, false)).toBe('loading');
    expect(contentState(true, true)).toBe('loading');
    expect(contentState(false, true)).toBe('ready');
    expect(contentState(false, false)).toBe('thin');
  });
});
