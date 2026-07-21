import {
  buildStreetRefCatalog,
  matchStreetRef,
} from '../acs/acs-street-coverage.util';

describe('e-SUS street matching', () => {
  const catalog = buildStreetRefCatalog([
    { id: 's1', name: 'São José', streetType: 'Rua' },
    { id: 's2', name: 'Principal', streetType: 'Avenida' },
    { id: 's3', name: 'São José', streetType: 'Travessa' },
  ]);

  it('casa logradouro com acento e prefixo quando único', () => {
    const single = buildStreetRefCatalog([
      { id: 's1', name: 'São José', streetType: 'Rua' },
    ]);
    expect(matchStreetRef('Rua Sao Jose', single).status).toBe('matched');
    expect(matchStreetRef('São José', catalog).status).toBe('ambiguous');
  });

  it('casa por nome parcial único', () => {
    const result = matchStreetRef('Avenida Principal', catalog);
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.street.id).toBe('s2');
    }
  });

  it('retorna ambíguo quando há mais de uma rua', () => {
    expect(matchStreetRef('Sao Jose', catalog).status).toBe('ambiguous');
  });

  it('retorna não encontrada', () => {
    expect(matchStreetRef('Rua Inexistente XYZ', catalog).status).toBe(
      'unmatched',
    );
  });
});
