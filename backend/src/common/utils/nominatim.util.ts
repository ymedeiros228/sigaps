export type NominatimResult = {
  placeId: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  kind: string;
};

function nominatimBaseUrl(configured?: string): string {
  return (configured?.trim() || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
}

export async function searchNominatim(
  query: string,
  options: {
    nominatimUrl?: string;
    municipalityName?: string;
    state?: string;
    limit?: number;
  } = {},
): Promise<NominatimResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const parts = [q];
  if (options.municipalityName) parts.push(options.municipalityName);
  if (options.state) parts.push(options.state);
  parts.push('Brasil');

  const params = new URLSearchParams({
    q: parts.join(', '),
    format: 'json',
    addressdetails: '1',
    limit: String(options.limit ?? 8),
    countrycodes: 'br',
  });

  const url = `${nominatimBaseUrl(options.nominatimUrl)}/search?${params}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SIGAPS/1.0 (gestao APS; contato@passagemfranca.ma.gov.br)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) return [];

  const rows = (await response.json()) as Array<{
    place_id: number;
    lat: string;
    lon: string;
    name?: string;
    display_name: string;
    type?: string;
    class?: string;
  }>;

  return rows.map((row) => ({
    placeId: String(row.place_id),
    name: row.name?.trim() || row.display_name.split(',')[0]?.trim() || q,
    displayName: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    kind: row.type || row.class || 'place',
  }));
}
