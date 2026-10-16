import { toNestUrl } from './serverless-url';

describe('toNestUrl (entrada da função do Vercel)', () => {
  it.each([
    ['/api/health', '/health'],
    ['/api', '/'],
    [undefined, '/'],
    ['/health', '/health'],
    // parâmetro injetado pelo rewrite do Vercel
    ['/api/auth/profile?path=auth%2Fprofile', '/auth/profile'],
    ['/api/streets?bbox=1,2,3,4&path=streets', '/streets?bbox=1%2C2%2C3%2C4'],
    ['/api/dashboard/abc?path=dashboard%2Fabc&x=1', '/dashboard/abc?x=1'],
    // query normal continua igual
    ['/api/search?q=rua%20a', '/search?q=rua+a'],
    // um "path" legítimo e diferente não é apagado
    ['/api/osm/import?path=outra', '/osm/import?path=outra'],
  ])('%s → %s', (input, expected) => {
    expect(toNestUrl(input)).toBe(expected);
  });
});
