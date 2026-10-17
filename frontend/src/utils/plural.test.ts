import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it('usa o singular só para 1', () => {
    expect(plural(1, 'rua pintada', 'ruas pintadas')).toBe('1 rua pintada');
    expect(plural(0, 'rua pintada', 'ruas pintadas')).toBe('0 ruas pintadas');
    expect(plural(1200, 'rua', 'ruas')).toBe('1.200 ruas');
  });
});
