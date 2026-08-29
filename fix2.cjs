const fs = require('fs');

const fixStr = `{(view === "login" || view === "register" || view === "forgot-password") && (
            <form onSubmit={handleSubmit} className="space-y-6">
            {view === "register" && (
              <div className="space-y-2 group">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2 group">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                Secure Comms ID (Email)
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                  placeholder="agent@sessionking.com"
                />
              </div>
            </div>

            {view !== "forgot-password" && (
              <div className="space-y-2 group">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                    Passcode
                  </label>
                  {view === "login" && (
                    <button type="button" onClick={() => setView("forgot-password")} className="text-[10px] text-gray-400 hover:text-gold transition-colors font-bold uppercase tracking-widest">
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gold transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {view === "register" && password && (
                  <div className="mt-2 h-1 w-full bg-black/50 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-300", getStrengthColor())} 
                      style={{ width: \`\${passwordStrength}%\` }}
                    />
                  </div>
                )}
              </div>
            )}

            {view === "register" && (
              <>
                <div className="space-y-2 group">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                    Verify Passcode
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gold transition-colors focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 group">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] group-focus-within:text-gold transition-colors">
                    Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors flex items-center justify-center font-bold">#</div>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/50 transition-all text-white placeholder:text-gray-700"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-white/20 bg-black/50 text-gold focus:ring-gold focus:ring-offset-matte-black cursor-pointer shadow-sm"
                  />
                  <label htmlFor="terms" className="text-[11px] text-gray-400 leading-tight">
                    I have read and strongly agree to the{" "}
                    <button type="button" className="text-gold hover:underline mx-1">Terms of Service</button>,{" "}
                    <button type="button" className="text-gold hover:underline mx-1">Privacy Policy</button>, and{" "}
                    <button type="button" className="text-gold hover:underline mx-1">Risk Disclosure</button>. 
                    I understand that trading involves high risk of loss.
                  </label>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full relative overflow-hidden group py-4 rounded-xl font-bold text-matte-black flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)]",
                isLoading ? "opacity-80 cursor-not-allowed bg-gold/50" : "bg-gold hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              {!isLoading && (
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              )}
              
              {isLoading ? (
                <>
                  <span className="uppercase tracking-widest text-sm">Scanning...</span>
                </>
              ) : (
                <>
                  <span className="uppercase tracking-widest text-sm relative z-10">
                    {view === "login" && "Initialize Link"}
                    {view === "register" && "Establish Connection"}
                    {view === "forgot-password" && "Transmit Recovery"}
                  </span>
                  <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          )}`;

let code = fs.readFileSync('src/components/AuthPage.tsx', 'utf8');
const sIdx = code.indexOf('          {(view === "login"');
const eIdx = code.indexOf("          {view === 'phone-login'");

if (sIdx !== -1 && eIdx !== -1) {
   code = code.substring(0, sIdx) + '          ' + fixStr + '\n' + code.substring(eIdx);
   fs.writeFileSync('src/components/AuthPage.tsx', code);
   console.log('Fixed');
} else {
   console.log('Not found');
}
