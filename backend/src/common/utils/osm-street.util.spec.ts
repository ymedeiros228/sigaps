import { inferStreetType, resolveOsmStreetName } from './osm-street.util';

describe('resolveOsmStreetName', () => {
  it('keeps named streets', () => {
    expect(resolveOsmStreetName({ highway: 'residential', name: 'Rua A' }, 1)).toBe('Rua A');
  });

  it('names unnamed residential streets', () => {
    expect(resolveOsmStreetName({ highway: 'residential' }, 999)).toBe('Rua sem nome #999');
  });

  it('names unnamed unclassified and tertiary streets', () => {
    expect(resolveOsmStreetName({ highway: 'unclassified' }, 42)).toBe('Via sem nome #42');
    expect(resolveOsmStreetName({ highway: 'tertiary' }, 7)).toBe('Via terciária #7');
  });

  it('names dirt roads and service ways', () => {
    expect(resolveOsmStreetName({ highway: 'track' }, 11)).toBe('Estrada de terra #11');
    expect(resolveOsmStreetName({ highway: 'service' }, 22)).toBe('Via de acesso #22');
  });

  it('uses ref when there is no name', () => {
    expect(resolveOsmStreetName({ highway: 'secondary', ref: 'MA-134' }, 3)).toBe('Estrada MA-134');
  });

  it('uses alt_name before generating synthetic label', () => {
    expect(resolveOsmStreetName({ highway: 'residential', alt_name: 'Beco do Campo' }, 5)).toBe(
      'Beco do Campo',
    );
  });
});

describe('inferStreetType', () => {
  it('classifies unnamed residential as Rua', () => {
    expect(inferStreetType('Rua sem nome #1', { highway: 'residential' })).toBe('Rua');
  });

  it('classifies track as estrada de terra', () => {
    expect(inferStreetType('Estrada de terra #2', { highway: 'track' })).toBe('Estrada de terra');
  });
});
