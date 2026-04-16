'use client'

import { useState, useEffect } from 'react'

interface GeoResult {
  id: number
  name: string
  country: string
  latitude: number
  longitude: number
}

interface WeatherState {
  temperature: number
  weatherCode: number
  city: string
  country: string
  timezone: string
}

type Condition = 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'snowy' | 'stormy'

function getCondition(code: number): Condition {
  if (code === 0) return 'clear'
  if (code <= 3) return 'cloudy'
  if (code <= 48) return 'foggy'
  if (code <= 67) return 'rainy'
  if (code <= 77) return 'snowy'
  if (code <= 82) return 'rainy'
  return 'stormy'
}

const BG: Record<Condition, string> = {
  clear:  'linear-gradient(160deg, #1a3a5c 0%, #2e6da4 55%, #4a9fd4 100%)',
  cloudy: 'linear-gradient(160deg, #2c3e50 0%, #4a5f73 55%, #5d7a8a 100%)',
  foggy:  'linear-gradient(160deg, #3a3a3a 0%, #5a5a5a 55%, #707070 100%)',
  rainy:  'linear-gradient(160deg, #0f0c29 0%, #1e1b4b 55%, #2d2a6e 100%)',
  snowy:  'linear-gradient(160deg, #1e2d40 0%, #2d4a6b 55%, #3d6080 100%)',
  stormy: 'linear-gradient(160deg, #0d0d0d 0%, #1a1a1a 55%, #2c1a1a 100%)',
}

function formatDateTime(timezone: string) {
  const now = new Date()
  const day = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone })
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  })
  return { day, time }
}

export default function WeatherWidget() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeoResult[]>([])
  const [weather, setWeather] = useState<WeatherState | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [dateTime, setDateTime] = useState({ day: '', time: '' })

  // Live clock — updates every minute
  useEffect(() => {
    if (!weather) return
    const update = () => setDateTime(formatDateTime(weather.timezone))
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [weather])

  // City search with debounce
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
        )
        const data = await res.json()
        setSuggestions(data.results || [])
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  async function selectCity(city: GeoResult) {
    setStatus('loading')
    setSuggestions([])
    setQuery('')
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${city.latitude}&longitude=${city.longitude}&current=temperature_2m,weather_code&timezone=auto`
      )
      const data = await res.json()
      setWeather({
        temperature: Math.round(data.current.temperature_2m),
        weatherCode: data.current.weather_code,
        city: city.name,
        country: city.country,
        timezone: data.timezone,
      })
      setStatus('idle')
    } catch {
      setStatus('error')
      setErrorMsg('Could not fetch weather. Try again.')
    }
  }

  const condition = weather ? getCondition(weather.weatherCode) : 'rainy'
  const bg = BG[condition]

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex-shrink-0"
      style={{ width: 400, height: 400, background: bg }}
    >
      {/* Subtle overlay for depth */}
      <div className="absolute inset-0 bg-black/20" />

      {weather && status !== 'loading' ? (
        // — Weather view —
        <div className="absolute inset-0 p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white font-semibold text-lg leading-tight">{dateTime.day}</p>
              <p className="text-white font-semibold text-lg leading-tight">{dateTime.time}</p>
            </div>
            <p className="text-white font-bold text-8xl tracking-tight leading-none">
              {weather.temperature}°
            </p>
          </div>
          <div>
            <p className="text-white font-semibold text-lg leading-tight">{weather.city}</p>
            <p className="text-white font-semibold text-lg leading-tight">{weather.country}</p>
            <button
              onClick={() => setWeather(null)}
              className="mt-3 text-white/50 text-sm hover:text-white/80 transition-colors cursor-pointer"
            >
              Change city
            </button>
          </div>
        </div>
      ) : (
        // — Search view —
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          {status === 'loading' ? (
            <p className="text-white font-semibold text-lg">Loading...</p>
          ) : (
            <div className="w-full relative">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Enter a city..."
                className="w-full bg-white/20 backdrop-blur-sm text-white placeholder-white/50 rounded-xl px-4 py-3 text-lg font-semibold outline-none border border-white/30 focus:border-white/70 transition-colors"
                autoFocus
              />
              {suggestions.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-black/80 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20 z-10">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectCity(s)}
                      className="w-full text-left px-4 py-3 text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-white/50 text-sm ml-2">{s.country}</span>
                    </button>
                  ))}
                </div>
              )}
              {status === 'error' && (
                <p className="mt-3 text-red-300 text-sm text-center">{errorMsg}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
