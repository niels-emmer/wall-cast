export type Lang = 'nl' | 'en'

export interface Translations {
  locale: string        // BCP-47 locale string for date/number formatting

  // Clock
  days: string[]        // Sunday … Saturday
  months: string[]      // January … December

  // Weather
  weatherTitle: string
  weatherLoading: string
  weatherUnavailable: string
  wind: string
  today: string
  sunrise: string
  sunset: string
  daylight: string      // suffix: "daglichttijd" / "daylight"
  daysShort: string[]   // Sun … Sat
  wmoLabels: Record<number, string>

  // Rain
  rainTitle: string
  now: string           // time axis "now" label
  dry: string
  peak: string          // "piek" / "peak" label in top-line summary
  noRainExpected: string
  rainLight: string
  rainMod: string
  rainHeavy: string

  // Garbage / Afval
  garbageTitle: string
  noCollection: string
  containerNames: Record<string, string>
  dayLabel: (days: number) => string

  // Calendar
  allDay: string
  nothingScheduled: string
  calendarUnavailable: string
  todaySection: string    // section header "Vandaag" / "Today"
  upcomingDays: string    // section header "Komende dagen" / "Upcoming days"

  // Polestar
  charging: string
  connected: string
  notConnected: string
  serviceOverdue: string
  timeForService: string
  serviceAlmostNeeded: string
  serviceRequired: string
  serviceNotification: string
  brakeFluid: string
  coolant: string
  oil: string
  fluidTooLow: string
  fluidTooHigh: string
  fluidServiceRequired: string
  fluidCheck: string
  range: string
  fullIn: (h: number, m: number) => string
  avg: string
  tripA: string
  tripB: string
  polestarUnavailable: string

  // Traffic
  trafficTitle: string
  trafficUnavailable: string
  travelTime: string
  trafficDelay: string
  noDelay: string
  trafficJams: string
  noJams: string
  onRoute: string
  km: string
  min: string

  // Bus departures
  busTitle: string
  busUnavailable: string
  busNoDepartures: string
  busOnTime: string
  busDelay: (min: number) => string
  busCancelled: string

  // KNMI Warnings
  warningsTitle: string
  warningsValidUntil: string
  warningsCodeLabel: (level: string) => string
  /** Map English CAP phenomenon names (from MeteoAlarm) to display label. */
  warningsPhenomenon: (phenomenon: string) => string

  // Air quality
  airQualityTitle: string
  airQualityLevel: (level: string) => string
  airQualityPollen: string
  pollenSpecies: (species: string) => string
  pollenLevel: (level: string) => string

  // Market / Fear & Greed
  marketTitle: string
  marketUnavailable: string
  marketFearGreed: string
  marketIndices: string
  marketStocks: string
  marketCrypto: string
  fearGreedLabel: (value: number) => string

  // P2000 Emergency Alerts
  p2000Title: string
  p2000Region: string
  p2000NoIncidents: string
  p2000Active: string
  p2000Historic: string
  p2000AgoMin: (n: number) => string
  p2000Unavailable: string
  p2000TickerBadge: string

  // Trump's Truth-o-Meter
  truthometerTitle: string
  truthometerUnavailable: string
  truthometerPerHour: string
  truthometerPer24h: string
  truthometerOriginals: string
  truthometerReposts: string
  truthometerTrendUp: string
  truthometerTrendDown: string
  truthometerTrendSteady: string
  truthometerRecent: string
  truthometerRetruth: string
  truthometerAgoMin: (n: number) => string

  // Shared
  unavailable: string
  loading: string
}

// ---------------------------------------------------------------------------
// Dutch
// ---------------------------------------------------------------------------

export const nl: Translations = {
  locale: 'nl-NL',

  days: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'],
  months: ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
           'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'],

  weatherTitle: 'Weer',
  weatherLoading: 'Laden...',
  weatherUnavailable: 'Weer niet beschikbaar',
  wind: 'Wind:',
  today: 'Vandaag',
  sunrise: 'Op',
  sunset: 'Onder',
  daylight: 'daglichttijd',
  daysShort: ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'],
  wmoLabels: {
    0:  'Helder',
    1:  'Grotendeels helder',
    2:  'Gedeeltelijk bewolkt',
    3:  'Bewolkt',
    45: 'Mist',
    48: 'IJsmist',
    51: 'Lichte motregen',
    53: 'Motregen',
    55: 'Zware motregen',
    61: 'Lichte regen',
    63: 'Regen',
    65: 'Zware regen',
    71: 'Lichte sneeuw',
    73: 'Sneeuw',
    75: 'Zware sneeuw',
    80: 'Buien',
    81: 'Buien',
    82: 'Zware buien',
    95: 'Onweer',
    96: 'Onweer+hagel',
    99: 'Onweer+hagel',
  },

  rainTitle: 'Regen',
  now: 'Nu',
  dry: 'Droog',
  peak: 'piek',
  noRainExpected: 'geen neerslag verwacht',
  rainLight: 'licht',
  rainMod: 'matig',
  rainHeavy: 'zwaar',

  garbageTitle: 'Afval',
  noCollection: 'Geen ophaling binnenkort',
  containerNames: { gft: 'GFT', pmd: 'PMD', restafval: 'Restafval' },
  dayLabel: (days) => {
    if (days === 0) return 'Vandaag'
    if (days === 1) return 'Morgen'
    return `Over ${days} dagen`
  },

  allDay: 'Hele dag',
  nothingScheduled: 'Niets gepland',
  calendarUnavailable: 'Agenda niet beschikbaar',
  todaySection: 'Vandaag',
  upcomingDays: 'Komende dagen',

  charging: 'Aan het laden',
  connected: 'Aangesloten',
  notConnected: 'Kabel los',
  serviceOverdue: 'Service achterstallig',
  timeForService: 'Tijd voor service',
  serviceAlmostNeeded: 'Service bijna nodig',
  serviceRequired: 'Service vereist',
  serviceNotification: 'Service melding',
  brakeFluid: 'Remvloeistof',
  coolant: 'Koelvloeistof',
  oil: 'Olie',
  fluidTooLow: 'te laag',
  fluidTooHigh: 'te hoog',
  fluidServiceRequired: 'service vereist',
  fluidCheck: 'controleer',
  range: 'bereik',
  fullIn: (h, m) => `vol over ${h}u${m > 0 ? `${m}m` : ''}`,
  avg: 'gem.',
  tripA: 'rit A',
  tripB: 'rit B',
  polestarUnavailable: 'Niet beschikbaar',

  trafficTitle: 'Verkeer',
  trafficUnavailable: 'Verkeer niet beschikbaar',
  travelTime: 'Reistijd',
  trafficDelay: 'vertraging',
  noDelay: 'geen vertraging',
  trafficJams: 'Files',
  noJams: 'Geen files',
  onRoute: 'op route',
  km: 'km',
  min: 'min',

  busTitle: 'Bus',
  busUnavailable: 'Niet beschikbaar',
  busNoDepartures: 'Geen vertrekken',
  busOnTime: 'op tijd',
  busDelay: (min) => `+${min} min`,
  busCancelled: 'rijdt niet',

  warningsTitle: 'Waarschuwingen',
  warningsValidUntil: 'geldig t/m',
  warningsCodeLabel: (level) => {
    const map: Record<string, string> = { geel: 'Code Geel', oranje: 'Code Oranje', rood: 'Code Rood' }
    return map[level] ?? level
  },
  warningsPhenomenon: (p) => {
    const map: Record<string, string> = {
      'Fog': 'Mist', 'Snow/ice': 'Sneeuw/ijzel', 'Snow': 'Sneeuw',
      'Ice': 'IJzel', 'Rain': 'Regen', 'Wind': 'Wind',
      'Thunderstorm': 'Onweer', 'Storm': 'Storm', 'Heat': 'Hitte',
      'Cold': 'Kou', 'Coastal event': 'Kustgevaar', 'Tornado': 'Tornado',
      'Forest fire': 'Bosbrand', 'Avalanche': 'Lawine', 'Flood': 'Overstroming',
    }
    return map[p] ?? p
  },

  airQualityTitle: 'Luchtkwaliteit',
  airQualityLevel: (level) => ({
    good: 'Goed', fair: 'Redelijk', moderate: 'Matig',
    poor: 'Slecht', very_poor: 'Zeer slecht', extremely_poor: 'Gevaarlijk',
  } as Record<string, string>)[level] ?? level,
  airQualityPollen: 'Pollen',
  pollenSpecies: (s) => ({
    birch: 'Berk', grass: 'Grassen', alder: 'Els',
    mugwort: 'Bijvoet', ragweed: 'Ambrosia',
  } as Record<string, string>)[s] ?? s,
  pollenLevel: (level) => ({
    none: 'Geen', low: 'Laag', moderate: 'Matig', high: 'Hoog', very_high: 'Zeer hoog',
  } as Record<string, string>)[level] ?? level,

  marketTitle: 'Markt',
  marketUnavailable: 'Marktdata niet beschikbaar',
  marketFearGreed: 'Angst & Hebzucht',
  marketIndices: 'Indices',
  marketStocks: 'Aandelen',
  marketCrypto: 'Crypto',
  fearGreedLabel: (v) => v <= 24 ? 'Extreme Angst' : v <= 44 ? 'Angst' : v <= 54 ? 'Neutraal' : v <= 74 ? 'Hebzucht' : 'Extreme Hebzucht',

  p2000Title: 'P2000',
  p2000Region: 'Regio',
  p2000NoIncidents: 'Geen meldingen',
  p2000Active: 'Actief',
  p2000Historic: 'Eerder vandaag',
  p2000AgoMin: (n) => n === 0 ? 'Nu' : `${n} min geleden`,
  p2000Unavailable: 'Niet beschikbaar',
  p2000TickerBadge: 'P2000',

  truthometerTitle:    "Trump's Truth-o-Meter",
  truthometerUnavailable: 'Truth Social niet beschikbaar',
  truthometerPerHour:  '/uur',
  truthometerPer24h:   '/24u',
  truthometerOriginals: 'origineel',
  truthometerReposts:  'repost',
  truthometerTrendUp:  'trending',
  truthometerTrendDown: 'rustiger',
  truthometerTrendSteady: 'stabiel',
  truthometerRecent:   'Recente Truths',
  truthometerRetruth:  'RETRUTH',
  truthometerAgoMin:   (n) => n === 0 ? 'Nu' : `${n} min geleden`,

  unavailable: 'Niet beschikbaar',
  loading: 'Laden...',
}

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

export const en: Translations = {
  locale: 'en-GB',

  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  months: ['January', 'February', 'March', 'April', 'May', 'June',
           'July', 'August', 'September', 'October', 'November', 'December'],

  weatherTitle: 'Weather',
  weatherLoading: 'Loading...',
  weatherUnavailable: 'Weather unavailable',
  wind: 'Wind:',
  today: 'Today',
  sunrise: 'Rise',
  sunset: 'Set',
  daylight: 'daylight',
  daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  wmoLabels: {
    0:  'Clear',
    1:  'Mostly clear',
    2:  'Partly cloudy',
    3:  'Overcast',
    45: 'Fog',
    48: 'Icy fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    80: 'Showers',
    81: 'Showers',
    82: 'Heavy showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm+hail',
    99: 'Thunderstorm+hail',
  },

  rainTitle: 'Rain',
  now: 'Now',
  dry: 'Dry',
  peak: 'peak',
  noRainExpected: 'no rain expected',
  rainLight: 'light',
  rainMod: 'mod.',
  rainHeavy: 'heavy',

  garbageTitle: 'Waste',
  noCollection: 'No collection soon',
  containerNames: { gft: 'GFT', pmd: 'PMD', restafval: 'Residual' },
  dayLabel: (days) => {
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    return `In ${days} days`
  },

  allDay: 'All day',
  nothingScheduled: 'Nothing scheduled',
  calendarUnavailable: 'Calendar unavailable',
  todaySection: 'Today',
  upcomingDays: 'Upcoming days',

  charging: 'Charging',
  connected: 'Connected',
  notConnected: 'Unplugged',
  serviceOverdue: 'Service overdue',
  timeForService: 'Time for service',
  serviceAlmostNeeded: 'Service almost due',
  serviceRequired: 'Service required',
  serviceNotification: 'Service notice',
  brakeFluid: 'Brake fluid',
  coolant: 'Coolant',
  oil: 'Oil',
  fluidTooLow: 'too low',
  fluidTooHigh: 'too high',
  fluidServiceRequired: 'service required',
  fluidCheck: 'check',
  range: 'range',
  fullIn: (h, m) => `full in ${h}h${m > 0 ? `${m}m` : ''}`,
  avg: 'avg.',
  tripA: 'trip A',
  tripB: 'trip B',
  polestarUnavailable: 'Unavailable',

  trafficTitle: 'Traffic',
  trafficUnavailable: 'Traffic unavailable',
  travelTime: 'Travel time',
  trafficDelay: 'delay',
  noDelay: 'no delay',
  trafficJams: 'Traffic jams',
  noJams: 'No jams',
  onRoute: 'on route',
  km: 'km',
  min: 'min',

  busTitle: 'Bus',
  busUnavailable: 'Unavailable',
  busNoDepartures: 'No departures',
  busOnTime: 'on time',
  busDelay: (min) => `+${min} min`,
  busCancelled: 'cancelled',

  warningsTitle: 'Warnings',
  warningsValidUntil: 'valid until',
  warningsCodeLabel: (level) => {
    const map: Record<string, string> = { geel: 'Code Yellow', oranje: 'Code Orange', rood: 'Code Red' }
    return map[level] ?? level
  },
  warningsPhenomenon: (p) => p, // MeteoAlarm already supplies English

  airQualityTitle: 'Air Quality',
  airQualityLevel: (level) => ({
    good: 'Good', fair: 'Fair', moderate: 'Moderate',
    poor: 'Poor', very_poor: 'Very Poor', extremely_poor: 'Hazardous',
  } as Record<string, string>)[level] ?? level,
  airQualityPollen: 'Pollen',
  pollenSpecies: (s) => ({
    birch: 'Birch', grass: 'Grass', alder: 'Alder',
    mugwort: 'Mugwort', ragweed: 'Ragweed',
  } as Record<string, string>)[s] ?? s,
  pollenLevel: (level) => ({
    none: 'None', low: 'Low', moderate: 'Moderate', high: 'High', very_high: 'Very High',
  } as Record<string, string>)[level] ?? level,

  marketTitle: 'Market',
  marketUnavailable: 'Market data unavailable',
  marketFearGreed: 'Fear & Greed',
  marketIndices: 'Indices',
  marketStocks: 'Stocks',
  marketCrypto: 'Crypto',
  fearGreedLabel: (v) => v <= 24 ? 'Extreme Fear' : v <= 44 ? 'Fear' : v <= 54 ? 'Neutral' : v <= 74 ? 'Greed' : 'Extreme Greed',

  p2000Title: 'P2000',
  p2000Region: 'Region',
  p2000NoIncidents: 'No incidents',
  p2000Active: 'Active',
  p2000Historic: 'Earlier today',
  p2000AgoMin: (n) => n === 0 ? 'Now' : `${n} min ago`,
  p2000Unavailable: 'Unavailable',
  p2000TickerBadge: 'P2000',

  truthometerTitle:       "Trump's Truth-o-Meter",
  truthometerUnavailable: 'Truth Social unavailable',
  truthometerPerHour:     '/hr',
  truthometerPer24h:      '/24h',
  truthometerOriginals:   'original',
  truthometerReposts:     'reposts',
  truthometerTrendUp:     'trending',
  truthometerTrendDown:   'quieter',
  truthometerTrendSteady: 'steady',
  truthometerRecent:      'Recent Truths',
  truthometerRetruth:     'RETRUTH',
  truthometerAgoMin:      (n) => n === 0 ? 'Now' : `${n} min ago`,

  unavailable: 'Unavailable',
  loading: 'Loading...',
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const LANGUAGES: Record<Lang, Translations> = { nl, en }
export const LANGUAGE_LABELS: Record<Lang, string> = { nl: 'Nederlands', en: 'English' }
