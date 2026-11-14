import { computed, inject, linkedSignal } from '@angular/core';

import type { RememberedSetting } from '../../shared/utilities/remembered-setting';
import { AuthService } from './auth.service';
import type { MediaDefaults } from './media-defaults.types';

/**
 * A choice whose default is the signed-in visitor's account setting. While signed in, the account value
 * is what the page opens with, and `set` changes it for this visit only: the saved account value returns
 * on the next visit, and changing it on the account page replaces whatever this visit chose. Signed out,
 * or when the account's defaults could not be read, it is the browser-remembered choice, exactly as before.
 * Call it from an injection context.
 */
export function accountDefaultedSetting<T extends string>(
  remembered: RememberedSetting<T>,
  fromAccount: (defaults: MediaDefaults) => T,
): RememberedSetting<T> {
  const defaults = inject(AuthService).mediaDefaults;
  const accountValue = computed(() => {
    const saved = defaults();

    return saved ? fromAccount(saved) : null;
  });
  const visitChoice = linkedSignal<T | null, T | null>({ source: accountValue, computation: () => null });

  return {
    value: computed(() => {
      const account = accountValue();

      return account === null ? remembered.value() : (visitChoice() ?? account);
    }),
    set(value: T): void {
      if (accountValue() === null) {
        remembered.set(value);
      } else {
        visitChoice.set(value);
      }
    },
  };
}
