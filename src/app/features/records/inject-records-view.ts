import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { HeroDataService } from '../heroes/hero-data.service';
import { heroIdentities } from '../insights/hero-identity';
import { PulseRecordsService } from './pulse-records.service';
import { buildRecordsView, type RecordsView } from './pulse-records-view';

export interface RecordsViewState {
  loading: Signal<boolean>;
  failed: Signal<boolean>;
  view: Signal<RecordsView | null>;
}

/**
 * Loads the boards and the roster for a Pulse Records page and reduces them to what it draws. Call it
 * from a field initialiser. A roster that cannot be loaded is not a failure: a hero is then drawn from
 * its id, so only the boards themselves can fail the page.
 */
export function injectRecordsView(rowLimit: number): RecordsViewState {
  // undefined while the request runs, null once it has failed.
  const records = toSignal(inject(PulseRecordsService).getPulseRecords());
  const roster = toSignal(inject(HeroDataService).getHeroRoster());

  return {
    loading: computed(() => records() === undefined || roster() === undefined),
    failed: computed(() => records() === null),
    view: computed(() => {
      const answer = records();

      return answer ? buildRecordsView(answer, heroIdentities(roster() ?? []), rowLimit) : null;
    }),
  };
}
