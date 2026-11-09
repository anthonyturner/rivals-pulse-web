import { Observable, of, Subject, throwError } from 'rxjs';

import { cachedRetryRequest } from './cached-retry-request';

describe('cachedRetryRequest', () => {
  let attempts: number;

  beforeEach(() => {
    attempts = 0;
    spyOn(console, 'error');
  });

  function reader(request: () => Observable<number>) {
    return cachedRetryRequest<number, string>({
      request: () => {
        attempts += 1;

        return request();
      },
      accept: (body) => (body > 0 ? `answer ${body}` : null),
      failureMessage: 'Failed to load the answer',
    });
  }

  function read(get: () => Observable<string | null>): (string | null)[] {
    const answers: (string | null)[] = [];

    get().subscribe((answer) => answers.push(answer));

    return answers;
  }

  it('sends nothing until the first caller asks', () => {
    reader(() => of(1));

    expect(attempts).toBe(0);
  });

  it('keeps an accepted answer: one request however many callers ask, now or later', () => {
    const body = new Subject<number>();
    const get = reader(() => body);

    const early = [read(get), read(get)];
    body.next(1);
    body.complete();
    const late = read(get);

    expect(attempts).toBe(1);
    expect([...early, late]).toEqual([['answer 1'], ['answer 1'], ['answer 1']]);
  });

  it('gives null and tries again on the next call when the request fails', () => {
    let fail = true;
    const get = reader(() => (fail ? throwError(() => new Error('down')) : of(2)));

    expect(read(get)).toEqual([null]);
    expect(console.error).toHaveBeenCalledWith('Failed to load the answer', jasmine.any(Error));

    fail = false;

    expect(read(get)).toEqual(['answer 2']);
    expect(attempts).toBe(2);
  });

  it('tries again when accept turns the body down, and keeps the first one it takes', () => {
    const bodies = [0, 3, 4];
    const get = reader(() => of(bodies.shift() as number));

    expect(read(get)).toEqual([null]);
    expect(read(get)).toEqual(['answer 3']);
    expect(read(get)).toEqual(['answer 3']);
    expect(attempts).toBe(2);
  });

  it('keeps each reader separate', () => {
    const first = reader(() => of(1));
    const second = reader(() => of(2));

    expect(read(first)).toEqual(['answer 1']);
    expect(read(second)).toEqual(['answer 2']);
  });
});
