import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, CreditCard, Activity, UserPlus, Wrench, Package } from 'lucide-react';
import { cn } from '../../lib/utils';

type FAQCategory = 'Subscription' | 'Signal Accuracy' | 'Account Creation' | 'Technical Troubleshooting' | 'Other';

const CATEGORIES: { label: FAQCategory; icon: React.ElementType }[] = [
  { label: 'Subscription', icon: CreditCard },
  { label: 'Signal Accuracy', icon: Activity },
  { label: 'Account Creation', icon: UserPlus },
  { label: 'Technical Troubleshooting', icon: Wrench },
  { label: 'Other', icon: Package }
];

const FAQS: { category: FAQCategory; question: string; answer: string }[] = [
  /* Subscription */
  {
    category: 'Subscription',
    question: 'How do I manage my subscription plan?',
    answer: "You can manage your subscription plan from the 'Pricing & Tiers' page or via your user profile settings. Here you can easily upgrade, downgrade, or cancel your active plan."
  },
  {
    category: 'Subscription',
    question: 'How do credits work for the Intelligence Engine?',
    answer: "Whenever you manually request the AI to analyze a specific asset or timeframe, one Intelligence Usage Credit is consumed. Your account has a fixed number of usages per month depending on your premium plan tier. If needed, you can purchase one-time top-ups in the AI Control Center via crypto payments."
  },
  {
    category: 'Subscription',
    question: 'When will I be billed?',
    answer: "Our system runs on monthly cycles starting from your initial payment date. You can find detailed invoice history in your Dashboard settings."
  },
  /* Signal Accuracy */
  {
    category: 'Signal Accuracy',
    question: 'How accurate are the signals?',
    answer: "The platform’s Adaptive Market Intelligence (AMI) targets a historic win rate between 65-75% depending on the asset and current market environment. Please treat these signals as strong confluence metrics, not direct financial advice."
  },
  {
    category: 'Signal Accuracy',
    question: 'Why am I not receiving signals?',
    answer: "If you don't receive signals it may be because of current 'Market Neutral' states (no clear edge found by the algorithm), you're on a free plan experiencing signal delays, or there is system maintenance."
  },
  {
    category: 'Signal Accuracy',
    question: 'How do I manage risk?',
    answer: "Never risk more than 1-2% of your account balance per trade. The platform automatically calculates and suggests standard Lot Sizes along with Stop Loss and Take Profit targets. It's your responsibility to review them."
  },
  /* Account Creation */
  {
    category: 'Account Creation',
    question: 'How do I verify my account?',
    answer: "Verification links are sent right when you register. If you missed it, head over to your Dashboard and click 'Resend Verification Email'."
  },
  {
    category: 'Account Creation',
    question: 'Can I use multiple accounts?',
    answer: "Our Terms of Service strictly forbid creating multiple accounts to farm free plan credits. Such activity may lead to a permanent ban across all associated IP addresses."
  },
  /* Technical Troubleshooting */
  {
    category: 'Technical Troubleshooting',
    question: 'Why does the Intelligence Terminal show "Awaiting Confirmation"?',
    answer: "This is a safety mechanism! It means the market condition does not perfectly align with our probability requirements for a secure trade. It is telling you to 'Sit on your hands' instead of forcing a losing trade."
  },
  {
    category: 'Technical Troubleshooting',
    question: 'I paid via Crypto but my plan didn\'t update. What do I do?',
    answer: "Crypto payments usually require several network confirmations before completing. This could take 10-30 minutes. If it hasn't processed within an hour, contact our support team using the form below with your transaction hash."
  },
  {
    category: 'Technical Troubleshooting',
    question: 'Why is my page taking too long to load?',
    answer: "Sometimes local cache causes interference with our live data websockets. We recommend clearing your browser cache or performing a hard refresh (Ctrl+F5 or Cmd+Shift+R). If the issue persists, ensure your network doesn't have restrictive firewalls blocking WebSocket connectivity."
  },
  /* Other */
  {
    category: 'Other',
    question: 'What pairs do you analyze?',
    answer: "We support over 35 significant instruments. This involves major forex pairs (EUR/USD, GBP/USD), cross pairs, popular commodities (Gold XAU/USD), and major Crypto (Bitcoin, Ethereum)."
  },
  {
    category: 'Other',
    question: 'Are there any hidden fees?',
    answer: "We ensure total transparency. There are no hidden performance or commission fees on signals generated via this terminal; your only cost is the subscription package."
  }
];

export function SupportFAQ() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory>('Subscription');
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);

  const filteredFAQS = FAQS.filter(faq => faq.category === activeCategory);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        Frequently Asked Questions
      </h2>
      
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => {
              setActiveCategory(label);
              setActiveFAQ(null);
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all border",
              activeCategory === label 
                ? "bg-gold/10 border-gold/40 text-gold" 
                : "bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-3">
        {filteredFAQS.length === 0 && (
          <div className="text-gray-500 py-4">No questions found for this category.</div>
        )}
        
        {filteredFAQS.map((faq, index) => (
          <div key={`${faq.category}-${index}`} className="glass-card border-white/5 overflow-hidden">
            <button
              onClick={() => setActiveFAQ(activeFAQ === index ? null : index)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
              <span className="font-bold text-sm md:text-base">{faq.question}</span>
              {activeFAQ === index ? (
                <ChevronUp className="w-5 h-5 text-gold" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </button>
            <AnimatePresence>
              {activeFAQ === index && (
                  <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 pb-4 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4"
                >
                  {faq.answer}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}
