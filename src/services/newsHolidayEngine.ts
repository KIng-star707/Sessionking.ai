import type { NewsEventItem, NewsRiskState, HolidayLiquidityStatus } from "../types";

// Currency to Pairs Map
export const CURRENCY_PAIRS_MAP: Record<string, string[]> = {
  USD: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD', 'USD/ZAR', 'USD/MXN', 'USD/TRY'],
  EUR: ['EUR/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/CHF', 'EUR/CAD', 'EUR/AUD', 'EUR/NZD'],
  GBP: ['GBP/USD', 'EUR/GBP', 'GBP/JPY', 'GBP/CHF', 'GBP/CAD', 'GBP/AUD', 'GBP/NZD'],
  JPY: ['USD/JPY', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'CAD/JPY', 'CHF/JPY'],
  AUD: ['AUD/USD', 'AUD/JPY', 'AUD/NZD', 'EUR/AUD', 'GBP/AUD', 'AUD/CAD', 'AUD/CHF'],
  NZD: ['NZD/USD', 'NZD/JPY', 'AUD/NZD', 'EUR/NZD', 'GBP/NZD', 'NZD/CAD', 'NZD/CHF'],
  CAD: ['USD/CAD', 'EUR/CAD', 'GBP/CAD', 'CAD/JPY', 'AUD/CAD', 'NZD/CAD', 'CAD/CHF'],
  CHF: ['USD/CHF', 'EUR/CHF', 'GBP/CHF', 'CHF/JPY', 'AUD/CHF', 'NZD/CHF', 'CAD/CHF'],
  XAU: ['XAU/USD', 'EUR/USD', 'USD/JPY'], // Gold is strongly dollar & real rate sensitive
  BTC: ['BTC/USD', 'ETH/USD', 'EUR/USD']
};

/**
 * Known Major Economic Events & Currency Mapping
 */
export const SCHEDULED_HIGH_IMPACT_EVENTS = [
  { keywords: ['FOMC', 'Federal Funds Rate', 'Fed Interest Rate', 'Fed Chair Powell'], currency: 'USD', impact: 'HIGH' as const, bufferMinutes: 120 },
  { keywords: ['Non-Farm Payrolls', 'NFP', 'US Unemployment Rate'], currency: 'USD', impact: 'HIGH' as const, bufferMinutes: 90 },
  { keywords: ['US Consumer Price Index', 'US CPI', 'Core CPI'], currency: 'USD', impact: 'HIGH' as const, bufferMinutes: 90 },
  { keywords: ['US GDP', 'US Gross Domestic Product'], currency: 'USD', impact: 'HIGH' as const, bufferMinutes: 60 },
  { keywords: ['ECB Interest Rate', 'ECB Monetary Policy', 'Lagarde Speech'], currency: 'EUR', impact: 'HIGH' as const, bufferMinutes: 120 },
  { keywords: ['Eurozone CPI', 'German CPI', 'German GDP'], currency: 'EUR', impact: 'HIGH' as const, bufferMinutes: 60 },
  { keywords: ['BoE Official Bank Rate', 'Bank of England Monetary Policy', 'Bailey Speech'], currency: 'GBP', impact: 'HIGH' as const, bufferMinutes: 120 },
  { keywords: ['UK CPI', 'UK Employment', 'UK Claimant Count'], currency: 'GBP', impact: 'HIGH' as const, bufferMinutes: 60 },
  { keywords: ['BoJ Policy Rate', 'Bank of Japan Rate Decision', 'Ueda Speech'], currency: 'JPY', impact: 'HIGH' as const, bufferMinutes: 120 },
  { keywords: ['RBA Cash Rate', 'RBA Rate Decision', 'Bullock Speech'], currency: 'AUD', impact: 'HIGH' as const, bufferMinutes: 90 },
  { keywords: ['RBNZ Official Cash Rate', 'RBNZ Rate Decision'], currency: 'NZD', impact: 'HIGH' as const, bufferMinutes: 90 },
  { keywords: ['BoC Rate Decision', 'Bank of Canada Monetary Policy'], currency: 'CAD', impact: 'HIGH' as const, bufferMinutes: 90 },
  { keywords: ['SNB Policy Rate', 'Swiss National Bank Rate Decision'], currency: 'CHF', impact: 'HIGH' as const, bufferMinutes: 90 },
];

/**
 * Standard Global Forex Holidays (Month is 0-indexed: 0 = Jan, 11 = Dec)
 */
export const GLOBAL_HOLIDAYS = [
  { name: "New Year's Day", month: 0, day: 1, currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'] },
  { name: "Martin Luther King Jr. Day", month: 0, day: 19, currencies: ['USD'] },
  { name: "Presidents' Day", month: 1, day: 16, currencies: ['USD'] },
  { name: "Good Friday", month: 3, day: 3, currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF'] },
  { name: "Easter Monday", month: 3, day: 6, currencies: ['EUR', 'GBP', 'AUD', 'NZD', 'CHF'] },
  { name: "Memorial Day", month: 4, day: 25, currencies: ['USD'] },
  { name: "US Independence Day", month: 6, day: 4, currencies: ['USD'] },
  { name: "Labor Day", month: 8, day: 7, currencies: ['USD', 'CAD'] },
  { name: "Thanksgiving Day (US)", month: 10, day: 26, currencies: ['USD'] },
  { name: "Christmas Day", month: 11, day: 25, currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'] },
  { name: "Boxing Day", month: 11, day: 26, currencies: ['EUR', 'GBP', 'CAD', 'AUD', 'NZD'] },
];

/**
 * Evaluates the news risk state for a given currency pair
 */
export function evaluateNewsRiskForPair(
  pair: string,
  events: NewsEventItem[] = []
): { riskState: NewsRiskState; relevantEvents: NewsEventItem[]; summary: string } {
  const [base, quote] = pair.replace('/', '').length === 6 
    ? [pair.replace('/', '').substring(0, 3), pair.replace('/', '').substring(3, 6)]
    : [pair.split('/')[0] || '', pair.split('/')[1] || ''];

  const matchedEvents = events.filter(e => {
    const affectedCurrencies = [e.currency];
    return affectedCurrencies.includes(base) || affectedCurrencies.includes(quote) || e.affectedPairs?.includes(pair);
  });

  if (matchedEvents.length === 0) {
    return {
      riskState: 'NORMAL',
      relevantEvents: [],
      summary: 'No high-impact economic releases scheduled within the immediate trading horizon.'
    };
  }

  const hasActiveCritical = matchedEvents.some(e => e.isActive && e.impact === 'HIGH');
  const hasApproachingCritical = matchedEvents.some(e => e.isApproaching && e.impact === 'HIGH');
  const hasMediumImpact = matchedEvents.some(e => e.impact === 'MEDIUM' || e.impact === 'HIGH');

  if (hasActiveCritical) {
    return {
      riskState: 'CRITICAL',
      relevantEvents: matchedEvents,
      summary: `CRITICAL EVENT RISK: High-impact release actively underway for ${matchedEvents[0].currency} (${matchedEvents[0].title}). New trade execution restricted.`
    };
  }

  if (hasApproachingCritical) {
    return {
      riskState: 'HIGH',
      relevantEvents: matchedEvents,
      summary: `HIGH EVENT RISK: High-impact release (${matchedEvents[0].title}) scheduled imminently for ${matchedEvents[0].currency}. Spread widening expected.`
    };
  }

  if (hasMediumImpact) {
    return {
      riskState: 'ELEVATED',
      relevantEvents: matchedEvents,
      summary: `ELEVATED EVENT RISK: Economic release (${matchedEvents[0].title}) active for ${matchedEvents[0].currency}. Elevated vigilance advised.`
    };
  }

  return {
    riskState: 'NORMAL',
    relevantEvents: matchedEvents,
    summary: 'Minor calendar releases detected; risk parameters remain within standard tolerance.'
  };
}

/**
 * Checks holiday and market closure status
 */
export function evaluateHolidayLiquidity(
  pair: string,
  now: Date = new Date()
): HolidayLiquidityStatus {
  const isCrypto = pair.includes('BTC') || pair.includes('ETH');
  
  // 1. Weekend Market Closure Check (Forex closes Friday ~22:00 UTC to Sunday ~21:00 UTC)
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  
  const isWeekendForex = (day === 6) || (day === 5 && hour >= 22) || (day === 0 && hour < 21);

  if (isWeekendForex && !isCrypto) {
    return {
      isHoliday: false,
      affectedCurrencies: ['EUR', 'USD', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'],
      liquidityStatus: 'MARKET_CLOSED',
      spreadMultiplier: 99.0,
      reason: 'Global Forex interbank market is closed for the weekend (Re-opens Sunday 21:00 UTC).'
    };
  }

  // 2. Global Holiday Check
  const month = now.getUTCMonth();
  const dateNum = now.getUTCDate();
  
  const holiday = GLOBAL_HOLIDAYS.find(h => h.month === month && h.day === dateNum);
  
  if (holiday) {
    const [base, quote] = pair.replace('/', '').length === 6 
      ? [pair.replace('/', '').substring(0, 3), pair.replace('/', '').substring(3, 6)]
      : [pair.split('/')[0] || '', pair.split('/')[1] || ''];

    const affectsBaseOrQuote = holiday.currencies.includes(base) || holiday.currencies.includes(quote);

    if (affectsBaseOrQuote) {
      return {
        isHoliday: true,
        holidayName: holiday.name,
        affectedCurrencies: holiday.currencies,
        liquidityStatus: 'REDUCED',
        spreadMultiplier: 2.5,
        reason: `${holiday.name}: Bank holiday in ${holiday.currencies.filter(c => c === base || c === quote).join('/')} markets. Institutional liquidity is significantly reduced.`
      };
    }
  }

  return {
    isHoliday: false,
    affectedCurrencies: [],
    liquidityStatus: 'NORMAL',
    spreadMultiplier: 1.0,
    reason: 'Normal interbank liquidity conditions active.'
  };
}
