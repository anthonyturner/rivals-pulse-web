import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readStatusAnswer } from './database-answer.ts';

describe('readStatusAnswer', () => {
  it('reads the status and the fields it promises', () => {
    const answer = readStatusAnswer({ status: 'linked', playerName: 'Aurora', retryAfter: 90 });

    assert.equal(answer.status, 'linked');
    assert.equal(answer.text('playerName'), 'Aurora');
    assert.equal(answer.retryAfter(), 90);
  });

  it('refuses anything that is not an object with a text status', () => {
    for (const bad of [null, undefined, 'linked', 7, true, [], [{ status: 'linked' }], {}, { status: 1 }, { status: null }]) {
      assert.throws(() => readStatusAnswer(bad), Error, JSON.stringify(bad));
    }
  });

  it('refuses a text field that is missing, blank or not text', () => {
    for (const playerName of [undefined, null, '', 5, {}, ['Aurora']]) {
      assert.throws(() => readStatusAnswer({ status: 'linked', playerName }).text('playerName'), /no usable playerName/);
    }
  });

  it('refuses a wait that is missing, not a whole number of seconds, or below one', () => {
    for (const retryAfter of [undefined, null, '90', 1.5, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => readStatusAnswer({ status: 'rate_limited', retryAfter }).retryAfter(), /no usable retryAfter/);
    }
  });

  it('names the status and field in the error but never their values', () => {
    assert.throws(
      () => readStatusAnswer({ status: 'linked', playerName: 42, email: 'a@b.c' }).text('playerName'),
      error => error instanceof Error && error.message.includes('"linked"') && !error.message.includes('a@b.c'),
    );
  });
});
