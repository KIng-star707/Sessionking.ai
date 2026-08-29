import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  Target, 
  Zap, 
  TrendingUp, 
  Activity,
  CheckCircle2,
  Info
} from "lucide-react";
import { cn } from "../lib/utils";

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  tip?: string;
}

const STEPS: Step[] = [
  {
    title: "1. Select Your Session",
    description: "Choose between Asian, London, New York, or Overlap sessions. Each session has different volatility and liquidity characteristics.",
    icon: <Clock className="w-8 h-8 text-blue-400" />,
    tip: "The New York/London Overlap usually offers the highest liquidity."
  },
  {
    title: "2. Pick a Currency Pair",
    description: "Select from a curated list of pairs available for your chosen session. You'll see real-time price feeds updating dynamically.",
    icon: <Target className="w-8 h-8 text-gold" />,
    tip: "Major pairs like EURUSD are generally more stable for beginners."
  },
  {
    title: "3. Choose Your Trading Style",
    description: "Select Scalp (fast), Day (medium), or Swing (long-term). The AMI Engine adjusts its logic based on your preferred timeframe.",
    icon: <Zap className="w-8 h-8 text-yellow-400" />,
    tip: "Scalp traders look for quick 5-15 pip moves, while Swing traders hold for days."
  },
  {
    title: "4. Interpret the Signal",
    description: "The engine provides BUY, SELL, or WAIT signals with a confidence score. High confidence (80%+) indicates stronger institutional alignment.",
    icon: <TrendingUp className="w-8 h-8 text-green-400" />,
    tip: "Never ignore a 'WAIT' signal—patience is a key institutional trait."
  },
  {
    title: "5. Monitor Your Stats",
    description: "Track your daily usage limits and account balance. Use the Backtest Engine to verify strategies against historical data.",
    icon: <Activity className="w-8 h-8 text-purple-400" />,
    tip: "Consistent risk management is more important than any single signal."
  }
];

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Tutorial({ isOpen, onClose }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg glass-card border-gold/30 p-8 overflow-hidden"
          >
            {/* Progress Bar */}
            <div className="absolute top-0 left-0 w-full h-1 bg-white/5">
              <motion.div 
                className="h-full bg-gold shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              />
            </div>

            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                      {STEPS[currentStep].icon}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">{STEPS[currentStep].title}</h3>
                      <p className="text-sm text-gold/60">Step {currentStep + 1} of {STEPS.length}</p>
                    </div>
                  </div>

                  <p className="text-gray-300 leading-relaxed text-lg">
                    {STEPS[currentStep].description}
                  </p>

                  {STEPS[currentStep].tip && (
                    <div className="p-4 bg-gold/5 border border-gold/10 rounded-xl flex gap-3 items-start">
                      <Info className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gold/80 italic">
                        <span className="font-bold uppercase tracking-tighter mr-1">Pro Tip:</span>
                        {STEPS[currentStep].tip}
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all",
                  currentStep === 0 ? "opacity-0 pointer-events-none" : "text-gray-400 hover:text-white"
                )}
              >
                <ChevronLeft className="w-5 h-5" /> Back
              </button>

              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2 bg-gold text-matte-black rounded-lg font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-gold/20"
              >
                {currentStep === STEPS.length - 1 ? (
                  <>Finish <CheckCircle2 className="w-5 h-5" /></>
                ) : (
                  <>Next <ChevronRight className="w-5 h-5" /></>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
