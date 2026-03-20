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
  notConnected: 'Niet aangesloten',
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
  notConnected: 'Not connected',
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

  unavailable: 'Unavailable',
  loading: 'Loading...',
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const LANGUAGES: Record<Lang, Translations> = { nl, en }
export const LANGUAGE_LABELS: Record<Lang, string> = { nl: 'Nederlands', en: 'English' }
