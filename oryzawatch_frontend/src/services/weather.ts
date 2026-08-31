export interface CurrentWeather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  weatherCode: number;
  description: string;
  observedAt: string;
}

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const weatherDescriptions: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy rain showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

const toCompassDirection = (degrees: number): string => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degrees / 45) % directions.length];
};

const WEATHER_LOCATIONS: Record<string, { latitude: string; longitude: string }> = {
  ASUNCION: { latitude: '7.45', longitude: '125.57' },
  // Carmen, Davao del Norte town center
  CARMEN: { latitude: '7.36', longitude: '125.70' },
};

export async function fetchWeather(municipality: string, signal?: AbortSignal): Promise<CurrentWeather> {
  const location = WEATHER_LOCATIONS[municipality.trim().toUpperCase()] ?? WEATHER_LOCATIONS.ASUNCION;
  const params = new URLSearchParams({
    latitude: location.latitude, longitude: location.longitude,
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
    timezone: 'Asia/Manila', forecast_days: '1',
  });
  const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Open-Meteo request failed (${response.status})`);
  const data = await response.json();
  const current = data.current;
  if (!current) throw new Error('Open-Meteo returned no current conditions');
  return {
    temperature: current.temperature_2m, humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m, windDirection: toCompassDirection(current.wind_direction_10m),
    precipitation: current.precipitation, weatherCode: current.weather_code,
    description: weatherDescriptions[current.weather_code] ?? 'Current conditions', observedAt: current.time,
  };
}

// Kept for callers that still need the original Asuncion-specific helper.
export function fetchAsuncionWeather(signal?: AbortSignal): Promise<CurrentWeather> {
  return fetchWeather('ASUNCION', signal);
}
