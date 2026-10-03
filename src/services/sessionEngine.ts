/**
 * SESSIONKING - Institutional Trading Session Engine
 * 
 * Manages session definitions, pair eligibility, expected volatility profiles,
 * and session-specific gating:
 * - Asian Session: 00:00 - 08:00 UTC
 * - London Session: 07:00 - 16:00 UTC
 * - New York Session: 12:00 - 21:00 UTC
 * - London - New York Overlap: 12:00 - 16:00 UTC
 * 
 * Enforces rule:
 * "Do NOT generate an analysis for a pair that is not valid for the selected session configuration."
 */

export type MarketSession = 'All' | 'Asian' | 'London' | 'New York' | 'Overlap';

export interface SessionInfo {
  session: MarketSession;
  currentUtcTime: string;
  utcHour: number;
  isActive: boolean;
  expectedVolatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'PEAK';
  eligiblePairs: string[];
  sessionNotes: string;
}

// Institutional Eligible Pair Matrices per Session
export const SESSION_ELIGIBLE_PAIRS: Record<MarketSession, string[]> = {
  All: [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'NZD/USD',
    'USD/CHF', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'AUD/NZD',
    'USD/SGD', 'USD/HKD', 'EUR/GBP', 'EUR/CHF', 'GBP/CHF', 'EUR/CAD',
    'GBP/CAD', 'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD', 'USD/MXN',
    'USD/BRL', 'USD/ZAR', 'USD/TRY', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100'
  ],
  Asian: [
    'USD/JPY', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'NZD/JPY', 'AUD/USD', 
    'NZD/USD', 'AUD/NZD', 'USD/SGD', 'USD/HKD', 'BTC/USD', 'ETH/USD', 'XAU/USD'
  ],
  London: [
    'EUR/USD', 'GBP/USD', 'EUR/JPY', 'GBP/JPY', 'EUR/GBP', 'USD/CHF', 
    'EUR/CHF', 'GBP/CHF', 'EUR/CAD', 'GBP/CAD', 'GER40', 'UK100', 'XAU/USD', 'XAG/USD'
  ],
  'New York': [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CAD', 'AUD/USD', 'NZD/USD', 
    'USD/CHF', 'XAU/USD', 'XAG/USD', 'BTC/USD', 'ETH/USD', 'US30', 'NAS100', 'SPX500',
    'USD/MXN', 'USD/BRL', 'USD/ZAR', 'USD/TRY'
  ],
  Overlap: [
    'EUR/USD', 'GBP/USD', 'USD/CAD', 'USD/CHF', 'EUR/CAD', 'GBP/CAD',
    'XAU/USD', 'XAG/USD', 'US30', 'NAS100', 'SPX500', 'GER40', 'UK100'
  ]
};

/**
 * Evaluates current UTC market session state and parameters.
 */
export function getCurrentSessionInfo(selectedSession: MarketSession = 'All'): SessionInfo {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const timeStr = `${String(utcHour).padStart(2, '0')}:${String(utcMinute).padStart(2, '0')} UTC`;

  let activeSession: MarketSession = 'All';
  let expectedVolatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'PEAK' = 'MEDIUM';
  let sessionNotes = '';

  if (utcHour >= 12 && utcHour < 16) {
    activeSession = 'Overlap';
    expectedVolatility = 'PEAK';
    sessionNotes = 'London & New York Overlap: Highest daily liquidity and institutional volume.';
  } else if (utcHour >= 7 && utcHour < 16) {
    activeSession = 'London';
    expectedVolatility = 'HIGH';
    sessionNotes = 'London Core Session: Major European interbank liquidity driving trend breakouts.';
  } else if (utcHour >= 12 && utcHour < 21) {
    activeSession = 'New York';
    expectedVolatility = 'HIGH';
    sessionNotes = 'New York Core Session: Heavy USD and index volume following morning release windows.';
  } else if (utcHour >= 0 && utcHour < 8) {
    activeSession = 'Asian';
    expectedVolatility = 'LOW';
    sessionNotes = 'Asian Session: Tokyo/Sydney focus; mean-reversion consolidation and JPY/AUD activity.';
  } else {
    expectedVolatility = 'LOW';
    sessionNotes = 'Inter-session transitional quiet period.';
  }

  const effectiveSession = selectedSession === 'All' ? activeSession : selectedSession;
  const eligible = SESSION_ELIGIBLE_PAIRS[effectiveSession] || SESSION_ELIGIBLE_PAIRS.All;

  return {
    session: effectiveSession,
    currentUtcTime: timeStr,
    utcHour,
    isActive: true,
    expectedVolatility,
    eligiblePairs: eligible,
    sessionNotes
  };
}

/**
 * Validates whether a requested pair is eligible for trading during the designated session.
 */
export function validatePairSessionEligibility(pair: string, session: MarketSession | string): {
  isEligible: boolean;
  reason?: string;
} {
  const normSession = String(session || 'All').replace(/\s*(Session|🇬🇧|🇺🇸|🔥|🌏)/gi, '').trim() as MarketSession;
  if (normSession === 'All' || !normSession) {
    return { isEligible: true };
  }

  const eligibleList = SESSION_ELIGIBLE_PAIRS[normSession] || SESSION_ELIGIBLE_PAIRS.All;
  if (!eligibleList) {
    return { isEligible: true };
  }

  const normalized = pair.trim().toUpperCase();
  const formatted = normalized.includes('/') ? normalized : `${normalized.substring(0, 3)}/${normalized.substring(3)}`;

  const isEligible = eligibleList.includes(formatted) || eligibleList.some(p => p.replace('/', '') === normalized.replace('/', ''));

  if (!isEligible) {
    return {
      isEligible: false,
      reason: `${pair} is not an eligible active trading pair during ${normSession} session configuration (Institutional volume and spread filter).`
    };
  }

  return { isEligible: true };
}
