import math

def calculate_sma(prices: list[float], period: int) -> float:
    if len(prices) < period:
        return 0.0
    return sum(prices[-period:]) / period

def calculate_ema(prices: list[float], period: int) -> float:
    if len(prices) < period:
        return 0.0
    k = 2 / (period + 1)
    ema = prices[0]
    for price in prices[1:]:
        ema = (price * k) + (ema * (1 - k))
    return ema

def calculate_rsi(prices: list[float], period: int = 14) -> float:
    if len(prices) < period + 1:
        return 50.0
    gains = []
    losses = []
    for i in range(1, len(prices)):
        diff = prices[i] - prices[i-1]
        if diff >= 0:
            gains.append(diff)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(diff))
    
    avg_gain = sum(gains[-period:]) / period
    avg_loss = sum(losses[-period:]) / period
    
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))

def calculate_atr(highs: list[float], lows: list[float], closes: list[float], period: int = 14) -> float:
    if len(highs) < period + 1:
        return 0.0
    tr_list = []
    for i in range(1, len(highs)):
        h = highs[i]
        l = lows[i]
        c_prev = closes[i-1]
        tr = max(h - l, abs(h - c_prev), abs(l - c_prev))
        tr_list.append(tr)
    return sum(tr_list[-period:]) / period

def calculate_adx(highs: list[float], lows: list[float], closes: list[float], period: int = 14) -> float:
    if len(highs) < period * 2:
        return 0.0
    
    tr_list = []
    plus_dm = []
    minus_dm = []
    
    for i in range(1, len(highs)):
        h = highs[i]
        l = lows[i]
        c_prev = closes[i-1]
        
        tr = max(h - l, abs(h - c_prev), abs(l - c_prev))
        tr_list.append(tr)
        
        up_move = h - highs[i-1]
        down_move = lows[i-1] - l
        
        if up_move > down_move and up_move > 0:
            plus_dm.append(up_move)
        else:
            plus_dm.append(0.0)
            
        if down_move > up_move and down_move > 0:
            minus_dm.append(down_move)
        else:
            minus_dm.append(0.0)
            
    # Simplified Smoothing for TR, +DM, -DM
    # Start with sum of first 14 periods
    smoothed_tr = sum(tr_list[:period])
    smoothed_plus_dm = sum(plus_dm[:period])
    smoothed_minus_dm = sum(minus_dm[:period])
    
    dx_list = []
    
    for i in range(period, len(tr_list)):
        smoothed_tr = smoothed_tr - (smoothed_tr / period) + tr_list[i]
        smoothed_plus_dm = smoothed_plus_dm - (smoothed_plus_dm / period) + plus_dm[i]
        smoothed_minus_dm = smoothed_minus_dm - (smoothed_minus_dm / period) + minus_dm[i]
        
        if smoothed_tr == 0:
            dx_list.append(0.0)
            continue
            
        plus_di = 100 * (smoothed_plus_dm / smoothed_tr)
        minus_di = 100 * (smoothed_minus_dm / smoothed_tr)
        
        if (plus_di + minus_di) == 0:
            dx_list.append(0.0)
        else:
            dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
            dx_list.append(dx)
            
    if len(dx_list) < period:
        return 0.0
        
    return calculate_ema(dx_list, period)  # ADX is technically RMA but EMA is a decent proxy in wild

def detect_volume_spike(volumes: list[float], period: int = 20) -> bool:
    if len(volumes) < period + 1:
        return False
    avg_volume = sum(volumes[-period-1:-1]) / period
    if avg_volume == 0: return False
    return volumes[-1] > avg_volume * 2.0
