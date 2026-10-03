//+------------------------------------------------------------------+
//|                                     SESSIONKING_DataBridge.mq5   |
//|                         Copyright 2026, SESSIONKING Technologies |
//|                          https://sessionking.intel/trading-bridge|
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, SESSIONKING Technologies"
#property link      "https://sessionking.intel/trading-bridge"
#property version   "3.00"
#property description "SESSIONKING Real-Time Market Intelligence Bridge"
#property description "Streams live ticks, quotes, symbol specs, and multi-timeframe OHLC bars (M1, M5, M15, H1, H4, D1) directly to SESSIONKING."
#property strict

//--- Inputs
input group "=== SESSIONKING Server Configuration ==="
input string   InpServerUrl     = "http://localhost:3000"; // SESSIONKING App Base URL
input string   InpApiKey        = "SESSIONKING-BROKER-TOKEN"; // Webhook / Bridge Secret
input int      InpHeartbeatSec  = 5;                       // Heartbeat Interval (Seconds)
input int      InpCandleSyncMin = 1;                       // Candle Sync Interval (Minutes)
input int      InpHistoryBars   = 100;                     // Bars per Timeframe to Transmit

input group "=== Pairs & Symbol Filtering ==="
input string   InpCustomSymbols = "EURUSD,GBPUSD,USDJPY,USDCAD,AUDUSD,XAUUSD"; // Symbols to Stream (Comma-separated, blank for current chart only)
input bool     InpStreamAllMarketWatch = false;            // Stream All Symbols in Market Watch

//--- Global Variables
datetime g_lastHeartbeat = 0;
datetime g_lastCandleSync = 0;
string   g_symbols[];
int      g_symbolsCount = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("[SESSIONKING] Initializing Real-Time Data Bridge EA v3.00...");
   
   // Enable WebRequest permission notice
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
   {
      Print("[SESSIONKING] Note: Automated trading/WebRequest is required for real-time cloud data feed.");
   }

   // Build symbols list
   if(InpStreamAllMarketWatch)
   {
      int total = SymbolsTotal(true);
      ArrayResize(g_symbols, total);
      g_symbolsCount = total;
      for(int i = 0; i < total; i++)
      {
         g_symbols[i] = SymbolName(i, true);
      }
   }
   else if(StringLen(InpCustomSymbols) > 0)
   {
      ushort sep = StringGetCharacter(",", 0);
      g_symbolsCount = StringSplit(InpCustomSymbols, sep, g_symbols);
      for(int i = 0; i < g_symbolsCount; i++)
      {
         StringTrimLeft(g_symbols[i]);
         StringTrimRight(g_symbols[i]);
      }
   }
   else
   {
      ArrayResize(g_symbols, 1);
      g_symbols[0] = _Symbol;
      g_symbolsCount = 1;
   }

   PrintFormat("[SESSIONKING] Tracking %d symbols for real-time intelligence streaming.", g_symbolsCount);
   
   // Send initial heartbeat
   SendHeartbeat();
   
   // Send initial candle snapshots
   SyncAllCandles();

   // Set timer for heartbeat and candle sync
   EventSetTimer(1);

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[SESSIONKING] Data Bridge EA deinitialized. Reason: ", reason);
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
   // Stream current chart symbol quote immediately on tick
   StreamSymbolQuote(_Symbol);
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
   datetime now = TimeCurrent();

   // Heartbeat check
   if(now - g_lastHeartbeat >= InpHeartbeatSec)
   {
      SendHeartbeat();
      g_lastHeartbeat = now;

      // Stream quotes for all configured symbols
      for(int i = 0; i < g_symbolsCount; i++)
      {
         if(g_symbols[i] != _Symbol)
         {
            StreamSymbolQuote(g_symbols[i]);
         }
      }
   }

   // Candle sync check
   if(now - g_lastCandleSync >= (InpCandleSyncMin * 60))
   {
      SyncAllCandles();
      g_lastCandleSync = now;
   }
}

//+------------------------------------------------------------------+
//| Sends Heartbeat payload to SESSIONKING                           |
//+------------------------------------------------------------------+
void SendHeartbeat()
{
   string broker = AccountInfoString(ACCOUNT_COMPANY);
   string server = AccountInfoString(ACCOUNT_SERVER);
   long login = AccountInfoInteger(ACCOUNT_LOGIN);
   string currency = AccountInfoString(ACCOUNT_CURRENCY);
   
   string json = StringFormat(
      "{\"broker\":\"%s\",\"server\":\"%s\",\"accountNumber\":\"%d\",\"currency\":\"%s\",\"symbolsCount\":%d,\"secret\":\"%s\"}",
      broker, server, login, currency, g_symbolsCount, InpApiKey
   );

   PostJson("/api/mt5/heartbeat", json);
}

//+------------------------------------------------------------------+
//| Streams quote & symbol specs for a symbol                        |
//+------------------------------------------------------------------+
void StreamSymbolQuote(string sym)
{
   MqlTick tick;
   if(!SymbolInfoTick(sym, tick)) return;

   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(sym, SYMBOL_POINT);
   double contract = SymbolInfoDouble(sym, SYMBOL_TRADE_CONTRACT_SIZE);
   double minVol = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double maxVol = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   double stepVol = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   int tradeMode = (int)SymbolInfoInteger(sym, SYMBOL_TRADE_MODE);
   string status = (tradeMode == SYMBOL_TRADE_MODE_FULL) ? "OPEN" : "DISABLED";

   string json = StringFormat(
      "{\"symbol\":\"%s\",\"brokerSymbol\":\"%s\",\"bid\":%.*f,\"ask\":%.*f,\"digits\":%d,\"pointSize\":%.*f,\"contractSize\":%.2f,\"minVolume\":%.2f,\"maxVolume\":%.2f,\"volumeStep\":%.2f,\"lastTick\":%.*f,\"tickVolume\":%d,\"tradingStatus\":\"%s\",\"secret\":\"%s\"}",
      sym, sym, digits, tick.bid, digits, tick.ask, digits, digits, point, contract, minVol, maxVol, stepVol, digits, tick.last, (int)tick.volume, status, InpApiKey
   );

   PostJson("/api/mt5/feed", json);
}

//+------------------------------------------------------------------+
//| Syncs M1, M5, M15, H1, H4, D1 candles for all configured symbols |
//+------------------------------------------------------------------+
void SyncAllCandles()
{
   for(int i = 0; i < g_symbolsCount; i++)
   {
      SyncSymbolTimeframe(g_symbols[i], PERIOD_M1,  "M1");
      SyncSymbolTimeframe(g_symbols[i], PERIOD_M5,  "M5");
      SyncSymbolTimeframe(g_symbols[i], PERIOD_M15, "M15");
      SyncSymbolTimeframe(g_symbols[i], PERIOD_H1,  "H1");
      SyncSymbolTimeframe(g_symbols[i], PERIOD_H4,  "H4");
      SyncSymbolTimeframe(g_symbols[i], PERIOD_D1,  "D1");
   }
}

//+------------------------------------------------------------------+
//| Syncs OHLC bars for a single timeframe                           |
//+------------------------------------------------------------------+
void SyncSymbolTimeframe(string sym, ENUM_TIMEFRAMES tf, string tfName)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int copied = CopyRates(sym, tf, 0, InpHistoryBars, rates);
   if(copied <= 0) return;

   int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
   string candlesJson = "[";
   
   for(int i = copied - 1; i >= 0; i--)
   {
      string item = StringFormat(
         "{\"time\":%d,\"open\":%.*f,\"high\":%.*f,\"low\":%.*f,\"close\":%.*f,\"volume\":%d}",
         (long)rates[i].time, digits, rates[i].open, digits, rates[i].high, digits, rates[i].low, digits, rates[i].close, (int)rates[i].tick_volume
      );
      candlesJson += item;
      if(i > 0) candlesJson += ",";
   }
   candlesJson += "]";

   string payload = StringFormat(
      "{\"symbol\":\"%s\",\"timeframe\":\"%s\",\"candles\":%s,\"secret\":\"%s\"}",
      sym, tfName, candlesJson, InpApiKey
   );

   PostJson("/api/mt5/candles", payload);
}

//+------------------------------------------------------------------+
//| Helper to POST JSON payload via WebRequest                       |
//+------------------------------------------------------------------+
bool PostJson(string endpoint, string jsonBody)
{
   string url = InpServerUrl + endpoint;
   char postData[];
   char resultData[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\nUser-Agent: MetaTrader5-SESSIONKING-EA/3.00\r\n";

   StringToCharArray(jsonBody, postData, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(postData, ArraySize(postData) - 1); // remove null terminator

   ResetLastError();
   int res = WebRequest("POST", url, headers, 3000, postData, resultData, resultHeaders);
   
   if(res == -1)
   {
      int err = GetLastError();
      // Error 4014: ERR_FUNCTION_NOT_ALLOWED -> WebRequest not allowed in Options -> Expert Advisors
      if(err == 4014)
      {
         PrintOnce("[SESSIONKING ERROR] WebRequest not permitted! Please add '", InpServerUrl, "' in MT5: Tools -> Options -> Expert Advisors -> Allow WebRequest for listed URL.");
      }
      return false;
   }
   return (res >= 200 && res < 300);
}

void PrintOnce(string msg1, string msg2 = "", string msg3 = "")
{
   static bool printed = false;
   if(!printed)
   {
      Print(msg1, msg2, msg3);
      printed = true;
   }
}
//+------------------------------------------------------------------+
