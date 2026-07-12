export interface SeasonWeather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windUnit: string;
}

export async function fetchSeasonWeather(lat: number, lon: number): Promise<SeasonWeather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&wind_speed_unit=kmh&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = await res.json() as {
      current?: { temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number };
    };
    const c = j.current;
    if (!c || c.temperature_2m == null) return null;
    return {
      temperature: Math.round(c.temperature_2m * 10) / 10,
      humidity: Math.round(c.relative_humidity_2m ?? 0),
      windSpeed: Math.round((c.wind_speed_10m ?? 0) * 10) / 10,
      windUnit: 'km/h',
    };
  } catch {
    return null;
  }
}
