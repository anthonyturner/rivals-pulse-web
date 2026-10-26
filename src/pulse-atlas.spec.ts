import {
  buildPulseAtlas,
  PULSE_ATLAS_DATASETS,
  PulseAtlasInput,
  verifyPulseAtlas,
} from './pulse-atlas';

const GENERATED_AT = '2026-10-26T12:00:00.000Z';
const fakeSha256 = (text: string): string => `sha:${text.length}:${text.slice(-12)}`;

function validInputs(): PulseAtlasInput[] {
  return [
    { dataset: 'heroes', source: 'test', data: [{ id: 'thor', name: 'Thor' }] },
    {
      dataset: 'tier-list',
      source: 'test',
      data: { tiers: [{ name: 'S', heroes: [{ heroId: 'thor' }] }] },
    },
    { dataset: 'glossary', source: 'test', data: [{ id: 'dive', term: 'Dive' }] },
    { dataset: 'maps', source: 'test', data: [{ id: 1032, name: 'Yggdrasill Path' }] },
  ];
}

function withData(dataset: PulseAtlasInput['dataset'], data: unknown): PulseAtlasInput[] {
  return validInputs().map((input) => (input.dataset === dataset ? { ...input, data } : input));
}

describe('buildPulseAtlas', () => {
  it('wraps each dataset in the versioned envelope under pulse-atlas/v1', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
    const heroes = files.find((file) => file.path === 'pulse-atlas/v1/heroes.json');

    expect(JSON.parse(heroes?.content ?? 'null')).toEqual({
      schemaVersion: 1,
      generatedAt: GENERATED_AT,
      source: 'test',
      data: [{ id: 'thor', name: 'Thor' }],
    });
    expect(files.map((file) => file.path)).toEqual([
      'pulse-atlas/v1/heroes.json',
      'pulse-atlas/v1/tier-list.json',
      'pulse-atlas/v1/glossary.json',
      'pulse-atlas/v1/maps.json',
      'pulse-atlas/v1/manifest.json',
    ]);
  });

  it('lists every dataset file in the manifest with its hash and size', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);
    const manifest = JSON.parse(files[files.length - 1].content);

    expect(manifest.generatedAt).toBe(GENERATED_AT);
    expect(manifest.files.map((entry: { dataset: string }) => entry.dataset)).toEqual([
      ...PULSE_ATLAS_DATASETS,
    ]);

    for (const entry of manifest.files) {
      const file = files.find((candidate) => candidate.path === entry.path);

      expect(entry.sha256).toBe(fakeSha256(file?.content ?? ''));
      expect(entry.bytes).toBe(new TextEncoder().encode(file?.content ?? '').length);
    }
  });

  it('keeps the file shape when only the source label changes', () => {
    const moved = validInputs().map((input) => ({ ...input, source: 'supabase' }));
    const shape = (inputs: PulseAtlasInput[]): string[] =>
      buildPulseAtlas(inputs, GENERATED_AT, fakeSha256).map((file) =>
        Object.keys(JSON.parse(file.content)).join(','),
      );

    expect(shape(moved)).toEqual(shape(validInputs()));
  });

  it('refuses an empty or missing dataset instead of publishing a broken file', () => {
    expect(() => buildPulseAtlas(withData('heroes', []), GENERATED_AT, fakeSha256)).toThrowError(
      /heroes: expected a non-empty list/,
    );
    expect(() => buildPulseAtlas(withData('glossary', null), GENERATED_AT, fakeSha256)).toThrowError(
      /glossary: expected a non-empty list/,
    );
    expect(() =>
      buildPulseAtlas(validInputs().slice(0, 3), GENERATED_AT, fakeSha256),
    ).toThrowError(/maps: expected exactly one input, got 0/);
  });

  it('refuses malformed entries and tier lists with no heroes', () => {
    expect(() =>
      buildPulseAtlas(withData('maps', [{ id: 'x', name: 'Y' }]), GENERATED_AT, fakeSha256),
    ).toThrowError(/maps: item 0 needs an integer id/);
    expect(() =>
      buildPulseAtlas(withData('tier-list', { tiers: [{ name: 'S', heroes: [] }] }), GENERATED_AT, fakeSha256),
    ).toThrowError(/tier-list: no tier lists any hero/);
  });

  it('refuses data that looks like player data, a secret or counter-source data', () => {
    const leaks: [string, unknown][] = [
      ['key', [{ id: 'thor', name: 'Thor', playerId: '42' }]],
      ['key', [{ id: 'thor', name: 'Thor', apiToken: 'x' }]],
      ['value', [{ id: 'thor', name: 'Thor', note: 'sb_secret_abc123' }]],
      ['value', [{ id: 'thor', name: 'Thor', note: 'from Counter Watch' }]],
    ];

    for (const [kind, data] of leaks) {
      expect(() => buildPulseAtlas(withData('heroes', data), GENERATED_AT, fakeSha256))
        .withContext(`${kind} leak`)
        .toThrowError(/heroes\[0\]/);
    }
  });
});

describe('verifyPulseAtlas', () => {
  it('accepts files whose hashes match the manifest', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256);

    expect(() => verifyPulseAtlas(files, fakeSha256)).not.toThrow();
  });

  it('rejects a file changed after the manifest was built', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256).map((file) =>
      file.path.endsWith('/maps.json') ? { ...file, content: `${file.content}\n ` } : file,
    );

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(/maps: hash does not match/);
  });

  it('rejects a missing manifest', () => {
    const files = buildPulseAtlas(validInputs(), GENERATED_AT, fakeSha256).slice(0, 4);

    expect(() => verifyPulseAtlas(files, fakeSha256)).toThrowError(/no pulse-atlas\/v1\/manifest\.json/);
  });
});
