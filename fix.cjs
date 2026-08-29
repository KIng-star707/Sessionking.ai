const fs = require('fs');
let content = fs.readFileSync('src/components/SignalEngine.tsx', 'utf8');

const target = `            </button>
            
            
                      </div>
                    </button>
                  ))}
                </div>`;

const rx = /<\/button>[\s\S]*?<\/div>\n\s*<\/button>\n\s*\}\)\)\}\n\s*<\/div>/;

const replacement = `            </button>
          </div>
        </div>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-3 mb-8"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Signal Output */}
        <AnimatePresence mode="wait">
          {isAnalyzing ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card overflow-hidden border-gold/30 p-8"
            >
              <div className="flex flex-col items-center justify-center py-12 gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-gold/20 border-t-gold rounded-full animate-spin" />
                  <BrandLogo className="w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="space-y-2 text-center w-full max-w-md">
                  <h3 className="text-xl font-bold text-white">Aggregating Global Liquidity Pools...</h3>
                  <p className="text-gray-400 text-sm">Analyzing multi-timeframe order flow for {pair}</p>
                </div>
              </div>
            </motion.div>
          ) : signal ? (
            <div className="space-y-6">
              {availableSignals.length > 1 && (
                <div className="flex flex-wrap gap-3 mb-6">
                  {availableSignals.map((sig, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSignal(sig)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-bold border transition-all flex flex-col items-start",
                        signal.type === sig.type && signal.entry === sig.entry 
                          ? "bg-gold text-matte-black border-gold" 
                          : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {sig.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {sig.type}
                      </div>
                    </button>
                  ))}
                </div>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/SignalEngine.tsx', content);
