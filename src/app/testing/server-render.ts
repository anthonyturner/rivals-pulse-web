import { APP_BASE_HREF } from '@angular/common';
import { destroyPlatform, EnvironmentProviders, Provider, provideZonelessChangeDetection, Type } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { renderApplication } from '@angular/platform-server';

/**
 * Lets a spec render a component on the server platform, which the test runner's browser platform
 * cannot do. Two things leak out of a server render, so `leave` puts both back: Angular allows one
 * platform at a time and the test runner holds the browser one, and the server platform overwrites
 * the browser's globals (Event, Node, Element...) with its own DOM classes.
 *
 * Call `enter()` in `beforeEach` and `leave()` in `afterEach`.
 */
export function serverRenderSandbox(): { enter(): void; leave(): void } {
  let globalsBefore = new Map<PropertyKey, PropertyDescriptor>();

  return {
    enter() {
      globalsBefore = new Map(
        Reflect.ownKeys(globalThis).flatMap((key): [PropertyKey, PropertyDescriptor][] => {
          const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);

          return descriptor === undefined ? [] : [[key, descriptor]];
        }),
      );
      getTestBed().resetTestEnvironment();
      destroyPlatform();
    },
    leave() {
      destroyPlatform();
      restoreGlobals(globalsBefore);
      getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
        errorOnUnknownElements: true,
        errorOnUnknownProperties: true,
      });
    },
  };
}

/** Server-renders `root` (whose selector must be `app-root`) and returns its HTML without `<style>` blocks. */
export async function renderOnServer(root: Type<unknown>, providers: (Provider | EnvironmentProviders)[] = []): Promise<string> {
  const page = await renderApplication(
    (context) =>
      bootstrapApplication(
        root,
        {
          providers: [provideZonelessChangeDetection(), { provide: APP_BASE_HREF, useValue: '/' }, ...providers],
        },
        context,
      ),
    { document: '<html><body><app-root></app-root></body></html>' },
  );

  return page.replace(/<style[\s\S]*?<\/style>/g, '');
}

function restoreGlobals(before: ReadonlyMap<PropertyKey, PropertyDescriptor>): void {
  for (const key of Reflect.ownKeys(globalThis)) {
    const original = before.get(key);

    if (original === undefined) {
      Reflect.deleteProperty(globalThis, key);
    } else if (!sameDescriptor(Object.getOwnPropertyDescriptor(globalThis, key), original)) {
      Object.defineProperty(globalThis, key, original);
    }
  }
}

function sameDescriptor(a: PropertyDescriptor | undefined, b: PropertyDescriptor): boolean {
  return a !== undefined && a.value === b.value && a.get === b.get && a.set === b.set && a.writable === b.writable;
}
