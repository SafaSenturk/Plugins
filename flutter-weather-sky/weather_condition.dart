/// Visual families used to pick the sky, the particles and the icon.
enum Sky { clear, partlyCloudy, cloudy, fog, drizzle, rain, snow, thunder }

/// Every WMO weather code Open-Meteo returns, grouped by meaning.
enum WeatherCondition {
  clear(Sky.clear),
  mainlyClear(Sky.clear),
  partlyCloudy(Sky.partlyCloudy),
  overcast(Sky.cloudy),
  fog(Sky.fog),
  drizzle(Sky.drizzle),
  freezingDrizzle(Sky.drizzle),
  lightRain(Sky.rain),
  rain(Sky.rain),
  heavyRain(Sky.rain),
  freezingRain(Sky.rain),
  lightSnow(Sky.snow),
  snow(Sky.snow),
  heavySnow(Sky.snow),
  rainShowers(Sky.rain),
  heavyShowers(Sky.rain),
  snowShowers(Sky.snow),
  thunderstorm(Sky.thunder),
  thunderstormHail(Sky.thunder),
  unknown(Sky.cloudy);

  const WeatherCondition(this.sky);

  final Sky sky;

  static WeatherCondition fromCode(int code) => switch (code) {
        0 => clear,
        1 => mainlyClear,
        2 => partlyCloudy,
        3 => overcast,
        45 || 48 => fog,
        51 || 53 || 55 => drizzle,
        56 || 57 => freezingDrizzle,
        61 => lightRain,
        63 => rain,
        65 => heavyRain,
        66 || 67 => freezingRain,
        71 => lightSnow,
        73 || 77 => snow,
        75 => heavySnow,
        80 || 81 => rainShowers,
        82 => heavyShowers,
        85 || 86 => snowShowers,
        95 => thunderstorm,
        96 || 99 => thunderstormHail,
        _ => unknown,
      };
}
