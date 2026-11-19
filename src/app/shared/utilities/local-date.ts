import { InjectionToken } from '@angular/core';

/** Today's date in the visitor's time zone, as a function so a test can fix it. */
export const LOCAL_DATE = new InjectionToken<() => Date>('LOCAL_DATE', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
