export type NominatimResult = {
  placeId: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  kind: string;
};

function nominatimBaseUrl(configured?: string): string {
  return (configured?.trim() || 'https://nominatim.openstreetmap.org').replace(
    /\/$/,
    '',
  );
}

export async function searchNominatim(
  query: string,
  options: {
    nominatimUrl?: string;
    municipalityName?: string;
    state?: string;
    limit?: number;
    latitude?: number;
    longitude?: number;
  } = {},
): Promise<NominatimResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const runSearch = async (searchQ: string) => {
    const params = new URLSearchParams({
      q: searchQ,
      format: 'json',
      addressdetails: '1',
      limit: String(options.limit ?? 8),
      countrycodes: 'br',
    });

    if (options.latitude != null && options.longitude != null) {
      const pad = 0.45;
      const west = options.longitude - pad;
      const south = options.latitude - pad;
      const east = options.longitude + pad;
      const north = options.latitude + pad;
      params.set('viewbox', `${west},${south},${east},${north}`);
      params.set('bounded', '0');
    }

    const url = `${nominatimBaseUrl(options.nominatimUrl)}/search?${params}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'SIGAPS/1.0 (gestao APS; contato@passagemfranca.ma.gov.br)',
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
  };

  const parts = [q];
  const lowerQ = q.toLowerCase();
  if (
    options.municipalityName &&
    !lowerQ.includes(options.municipalityName.toLowerCase())
  ) {
    parts.push(options.municipalityName);
  }
  if (options.state && !lowerQ.includes(options.state.toLowerCase())) {
    parts.push(options.state);
  }
  parts.push('Brasil');

  const primary = await runSearch(parts.join(', '));
  if (primary.length > 0) return primary;

  if (options.municipalityName) {
    const fallback = await runSearch(
      `${q}, ${options.municipalityName}, Maranhão, Brasil`,
    );
    if (fallback.length > 0) return fallback;
  }

  return runSearch(`${q}, Brasil`);
}
