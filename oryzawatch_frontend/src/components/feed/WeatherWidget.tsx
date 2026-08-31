import React, { useEffect, useState } from 'react';
import { fetchWeather } from '../../services/weather';
import type { CurrentWeather } from '../../services/weather';

interface WeatherWidgetProps { municipality?: string; }

const formatObservedTime = (value: string) => new Date(value).toLocaleTimeString([], {
  hour: 'numeric', minute: '2-digit',
});

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ municipality = 'ASUNCION' }) => {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadWeather = async () => {
      try {
        setWeather(await fetchWeather(municipality, controller.signal));
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    };
    loadWeather();
    const refresh = window.setInterval(loadWeather, 10 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(refresh); };
  }, [municipality]);

  const municipalityLabel = municipality.charAt(0).toUpperCase() + municipality.slice(1).toLowerCase();
  const rows = weather ? [
    { label: '🌡️Temperature', value: `${weather.temperature.toFixed(1)}°C` },
    { label: '💧Humidity', value: `${weather.humidity.toFixed(0)}%`, warning: weather.humidity >= 85 },
    { label: '💨Wind', value: `${weather.windDirection} · ${weather.windSpeed.toFixed(1)} km/h` },
    { label: '🌤️Conditions', value: weather.description, emphasized: true },
    { label: '🌧️Precipitation', value: `${weather.precipitation.toFixed(1)} mm` },
  ] : [];

  return (
    <div className="glass-card-interactive" style={{ padding: '24px', backgroundColor: '#ffffff' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '18px', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '6px' }}>
        Weather · {municipalityLabel}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {!weather && !error && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading current conditions...</div>}
        {error && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Weather data unavailable right now.</div>}
        {rows.map((row, index) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: index < rows.length - 1 ? '1px solid var(--border-light)' : 'none', paddingBottom: index < rows.length - 1 ? '12px' : '0' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{row.label}</span>
            <span style={{ fontSize: '13.5px', color: row.warning ? '#d97706' : 'var(--text-primary)', fontWeight: row.emphasized ? 700 : 600 }}>{row.value}</span>
          </div>
        ))}
        {weather && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Updated {formatObservedTime(weather.observedAt)} · Open-Meteo</div>}
      </div>
    </div>
  );
};

export default WeatherWidget;
