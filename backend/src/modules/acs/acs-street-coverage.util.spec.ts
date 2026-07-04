import {
  buildStreetCoverageVariants,
  buildStreetSearchKeys,
  splitStreetCoverageText,
} from './acs-street-coverage.util';

describe('acs-street-coverage.util', () => {
  it('splits free-form street coverage text', () => {
    expect(
      splitStreetCoverageText('Rua do Sol; Travessa da Paz\n• Avenida Central | Beco da Feira'),
    ).toEqual([
      'Rua do Sol',
      'Travessa da Paz',
      'Avenida Central',
      'Beco da Feira',
    ]);
  });

  it('builds normalized variants without street prefixes', () => {
    expect(buildStreetCoverageVariants('Rua São José')).toEqual(['rua sao jose', 'sao jose']);
  });

  it('builds searchable keys from street type and name', () => {
    expect(buildStreetSearchKeys({ name: 'São José', streetType: 'Rua' })).toEqual([
      'sao jose',
      'rua sao jose',
    ]);
  });
});
