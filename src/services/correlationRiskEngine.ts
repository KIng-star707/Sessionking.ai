import type { 
  Signal, 
  CorrelationRiskReport, 
  CurrencyExposure 
} from "../types";

export interface ProspectiveTradeInput {
  pair: string;
  direction: 'BUY' | 'SELL' | 'WAIT';
  riskPercent?: number; // e.g. 2.0
}

const DEFAULT_PORTFOLIO_RISK_CEILING = 6.0; // Max 6.0% simultaneous risk across portfolio
const MAX_CONCURRENT_CURRENCY_EXPOSURE = 2; // Max 2 trades stacking the same single currency direction

/**
 * Calculates net currency exposures and correlation risk across
 * all active positions + a prospective new trade candidate.
 */
export function evaluatePortfolioCorrelation(
  activeTrades: Signal[],
  newTrade?: ProspectiveTradeInput,
  portfolioCeiling: number = DEFAULT_PORTFOLIO_RISK_CEILING
): CorrelationRiskReport {
  const exposedCurrencies: Record<string, CurrencyExposure> = {};
  const warnings: string[] = [];
  let totalPortfolioRisk = 0;

  const parsePairCurrencies = (pair: string): [string, string] => {
    const clean = pair.replace('/', '');
    if (clean.length === 6) {
      return [clean.substring(0, 3), clean.substring(3, 6)];
    }
    const parts = pair.split('/');
    return [parts[0] || 'XXX', parts[1] || 'YYY'];
  };

  const addExposure = (pair: string, dir: 'BUY' | 'SELL' | 'WAIT', risk: number = 2.0) => {
    if (dir === 'WAIT') return;
    const [base, quote] = parsePairCurrencies(pair);

    // Initialize base
    if (!exposedCurrencies[base]) {
      exposedCurrencies[base] = { currency: base, baseCount: 0, quoteCount: 0, netExposureUnits: 0, direction: 'NEUTRAL' };
    }
    // Initialize quote
    if (!exposedCurrencies[quote]) {
      exposedCurrencies[quote] = { currency: quote, baseCount: 0, quoteCount: 0, netExposureUnits: 0, direction: 'NEUTRAL' };
    }

    if (dir === 'BUY') {
      exposedCurrencies[base].baseCount += 1;
      exposedCurrencies[base].netExposureUnits += 1; // Long Base
      exposedCurrencies[quote].quoteCount += 1;
      exposedCurrencies[quote].netExposureUnits -= 1; // Short Quote
    } else if (dir === 'SELL') {
      exposedCurrencies[base].baseCount += 1;
      exposedCurrencies[base].netExposureUnits -= 1; // Short Base
      exposedCurrencies[quote].quoteCount += 1;
      exposedCurrencies[quote].netExposureUnits += 1; // Long Quote
    }

    totalPortfolioRisk += risk;
  };

  // 1. Process existing active trades
  activeTrades.forEach(trade => {
    if (trade.status === 'ACTIVE' && trade.type && trade.type !== 'WAIT') {
      addExposure(trade.pair, trade.type, trade.risk_percent || 2.0);
    }
  });

  // 2. Process prospective trade if provided
  if (newTrade && newTrade.direction !== 'WAIT') {
    addExposure(newTrade.pair, newTrade.direction, newTrade.riskPercent || 2.0);
  }

  // 3. Finalize directional states & check thresholds
  let highestSingleCurrencyConcentration = 0;
  let dominantCurrency = '';

  Object.values(exposedCurrencies).forEach(exp => {
    if (exp.netExposureUnits > 0) exp.direction = 'LONG';
    else if (exp.netExposureUnits < 0) exp.direction = 'SHORT';
    else exp.direction = 'NEUTRAL';

    const absUnits = Math.abs(exp.netExposureUnits);
    if (absUnits > highestSingleCurrencyConcentration) {
      highestSingleCurrencyConcentration = absUnits;
      dominantCurrency = exp.currency;
    }

    if (absUnits >= MAX_CONCURRENT_CURRENCY_EXPOSURE + 1) {
      warnings.push(`Excessive correlated ${exp.direction} exposure detected on ${exp.currency} (${absUnits} stacked positions).`);
    } else if (absUnits === MAX_CONCURRENT_CURRENCY_EXPOSURE) {
      warnings.push(`Elevated correlation concentration on ${exp.currency} (${absUnits} positions).`);
    }
  });

  if (totalPortfolioRisk > portfolioCeiling) {
    warnings.push(`Total portfolio risk (${totalPortfolioRisk.toFixed(1)}%) exceeds safety ceiling (${portfolioCeiling.toFixed(1)}%).`);
  }

  // Determine Risk Level
  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
  let isTradeAllowed = true;

  if (totalPortfolioRisk > portfolioCeiling || highestSingleCurrencyConcentration > MAX_CONCURRENT_CURRENCY_EXPOSURE) {
    riskLevel = 'CRITICAL';
    isTradeAllowed = false;
  } else if (totalPortfolioRisk >= portfolioCeiling || highestSingleCurrencyConcentration === MAX_CONCURRENT_CURRENCY_EXPOSURE) {
    riskLevel = 'HIGH';
    isTradeAllowed = totalPortfolioRisk <= portfolioCeiling;
  } else if (totalPortfolioRisk >= 4.0 || highestSingleCurrencyConcentration >= 2) {
    riskLevel = 'MODERATE';
    isTradeAllowed = true;
  } else {
    riskLevel = 'LOW';
    isTradeAllowed = true;
  }

  return {
    riskLevel,
    portfolioRiskPercent: Math.round(totalPortfolioRisk * 10) / 10,
    maxRiskCeiling: portfolioCeiling,
    exposedCurrencies,
    warnings,
    isTradeAllowed
  };
}
