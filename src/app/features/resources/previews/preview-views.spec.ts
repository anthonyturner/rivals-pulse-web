import { STRATEGIST_GUIDES } from '../../learning/guides/strategist-guides/strategist-guides.data';
import { strategistPreview } from './preview-views';

describe('strategistPreview', () => {
  it('names each topic and each hero once, as the guides do', () => {
    const { topics, heroes } = strategistPreview();

    expect(topics).toEqual([...new Set(STRATEGIST_GUIDES.map((guide) => guide.category))]);
    expect(heroes.map((hero) => hero.imageUrl)).toEqual([...new Set(STRATEGIST_GUIDES.map((guide) => guide.heroImage))]);
  });
});
