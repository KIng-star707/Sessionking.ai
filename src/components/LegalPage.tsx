import { useEffect, useRef } from "react";
import { Shield, Lock, AlertTriangle, FileText, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import type { LegalSectionType } from "../App";
import { motion } from "motion/react";

interface LegalPageProps {
  activeSection: LegalSectionType;
  onSectionChange: (section: LegalSectionType) => void;
}

export default function LegalPage({ activeSection, onSectionChange }: LegalPageProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll to top when section changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSection]);

  const sections = [
    { id: "terms", icon: <FileText className="w-5 h-5" />, title: "Terms of Service" },
    { id: "privacy", icon: <Lock className="w-5 h-5" />, title: "Privacy Policy" },
    { id: "risk", icon: <AlertTriangle className="w-5 h-5" />, title: "Risk Disclosure" },
  ];

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 border border-gold/20 mb-6">
          <Shield className="w-8 h-8 text-gold" />
        </div>
        <h1 className="text-3xl md:text-5xl font-bold uppercase tracking-widest mb-4">Legal & Compliance</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          We believe in full transparency and global fintech compliance. Please review our terms, privacy policies, and risk disclosures carefully.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-16 relative">
        {/* Sticky Sidebar Navigation */}
        <aside className="w-full md:w-64 lg:w-72 flex-shrink-0">
          <div className="md:sticky md:top-32 space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id as LegalSectionType)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                  activeSection === section.id 
                    ? "bg-gold/10 border-gold/30 text-gold shadow-[0_0_15px_rgba(255,215,0,0.1)]" 
                    : "bg-white/5 border-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                )}
              >
                <div className="flex items-center gap-3 font-bold uppercase tracking-wider text-sm">
                  {section.icon}
                  {section.title}
                </div>
                {activeSection === section.id && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-grow bg-white/5 border border-white/10 rounded-2xl p-6 md:p-10 lg:p-12 mb-20" ref={contentRef}>
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="prose prose-invert prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-widest prose-a:text-gold max-w-none"
          >
            {activeSection === "terms" && <TermsOfService />}
            {activeSection === "privacy" && <PrivacyPolicy />}
            {activeSection === "risk" && <RiskDisclosure />}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

function TermsOfService() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent mb-2">Terms of Service</h2>
        <p className="text-gray-400 text-sm italic">Last Updated: October 2023</p>
      </div>

      <section>
        <h3 className="text-xl text-gold mb-3">1.1 Acceptance of Terms</h3>
        <p className="text-gray-300 leading-relaxed">
          By accessing and using SESSIONKING platform, you agree to be bound by these Terms of Service, our Privacy Policy, and Risk Disclosure. If you do not agree to these terms, please do not use our services.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">1.2 Description of Service</h3>
        <p className="text-gray-300 leading-relaxed">
          SESSIONKING provides algorithmic forex analysis, adaptive market intelligence, and institutional-grade educational resources. <strong>Our platform and the information contained herein do NOT constitute financial, investment, or trading advice.</strong> All signals and insights are provided for educational and informational purposes only.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">1.3 User Responsibilities</h3>
        <ul className="list-disc pl-5 mt-2 space-y-2 text-gray-300">
          <li>You acknowledge that you trade at your own risk.</li>
          <li>You must provide accurate and complete account information.</li>
          <li>You agree not to misuse the platform, attempt to breach our security, or disrupt the services provided to other users.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">1.4 Account & Security</h3>
        <p className="text-gray-300 leading-relaxed">
          Users are solely responsible for maintaining the confidentiality of their login credentials. SESSIONKING and its operators are not liable for any unauthorized access to your account or any resulting damages.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">1.5 Subscription & Payments</h3>
        <ul className="list-disc pl-5 mt-2 space-y-2 text-gray-300">
          <li>Subscriptions are billed in advance on a monthly or annual basis.</li>
          <li>We make absolutely <strong>no guarantees of trading profits</strong>.</li>
          <li>SESSIONKING does not provide any refunds after a payment is made. All sales are final.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">1.6 Prohibited Activities</h3>
        <p className="text-gray-300 leading-relaxed mb-2">You strictly agree not to:</p>
        <ul className="list-disc pl-5 space-y-2 text-gray-300">
          <li>Reverse engineer, decompile, or otherwise attempt to extract the source code or proprietary algorithms of the platform.</li>
          <li>Resell, redistribute, or publicly broadcast any signals or insights obtained from SESSIONKING.</li>
          <li>Use automated bots, scrapers, or other tools to aggressively exploit our system.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">1.7 Termination</h3>
        <p className="text-gray-300 leading-relaxed">
          Platform administrators reserve the right to suspend or immediately terminate any account that violates these terms, engages in suspicious activity, or poses a risk to the platform, without prior notice.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">1.8 Limitation of Liability</h3>
        <p className="text-gray-300 leading-relaxed">
          Under no circumstances shall SESSIONKING, its creators, affiliates, or employees be held responsible for any trading losses, missed opportunities, or damages arising from the use of our platform. There is no guarantee of signal accuracy.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">1.9 Modifications</h3>
        <p className="text-gray-300 leading-relaxed">
          We reserve the right to modify these Terms of Service at any time. Continued use of the platform after updates constitutes acceptance of the revised terms.
        </p>
      </section>
    </div>
  );
}

function PrivacyPolicy() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent mb-2">Privacy Policy</h2>
        <p className="text-gray-400 text-sm italic">Last Updated: October 2023</p>
      </div>

      <section>
        <h3 className="text-xl text-gold mb-3">2.1 Data Collection</h3>
        <p className="text-gray-300 leading-relaxed">
          We collect information to provide better services to our users. This includes:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-2 text-gray-300">
          <li><strong>Personal Information:</strong> Name, email address, and authentication details.</li>
          <li><strong>Usage Data:</strong> Analytics, interface interactions, and behavioral data regarding how you use the platform.</li>
          <li><strong>Trading Preferences:</strong> Saved strategies, favorite pairs, and usage patterns within the Signal Engine.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">2.2 How Data is Used</h3>
        <p className="text-gray-300 leading-relaxed mb-2">We use the collected data to:</p>
        <ul className="list-disc pl-5 space-y-2 text-gray-300">
          <li>Improve algorithmic signal accuracy based on aggregate user interaction.</li>
          <li>Personalize your experience and adapt the interface to your trading style.</li>
          <li>Send crucial account notifications, security alerts, and platform updates.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">2.3 Data Storage</h3>
        <p className="text-gray-300 leading-relaxed">
          All user data is stored in deeply secure, encrypted cloud databases (Firebase/Google Cloud). We strictly do not sell or engage in unauthorized sharing of your personal data with third-party advertisers.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">2.4 Third-Party Services</h3>
        <p className="text-gray-300 leading-relaxed mb-2">To operate effectively, we integrate with secure third-party services:</p>
        <ul className="list-disc pl-5 space-y-2 text-gray-300">
          <li><strong>Authentication & Database:</strong> Google Firebase.</li>
          <li><strong>Payment Gateways:</strong> Stripe (or similar processors) for secure billing.</li>
          <li><strong>Market Data:</strong> Third-party charting and aggregated financial data feeds.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">2.5 Cookies & Tracking</h3>
        <p className="text-gray-300 leading-relaxed">
          We use strictly necessary cookies to maintain your session and security, alongside performance cookies to analyze platform usage and optimize response times.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">2.6 User Rights</h3>
        <p className="text-gray-300 leading-relaxed mb-2">Under global data protection regulations (like GDPR and CCPA), you have the right to:</p>
        <ul className="list-disc pl-5 space-y-2 text-gray-300">
          <li>Access a copy of your personal data.</li>
          <li>Request permanent deletion of your account and associated data.</li>
          <li>Opt-out of marketing or non-critical email communications.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">2.7 Data Security</h3>
        <p className="text-gray-300 leading-relaxed">
          While we employ industry-standard security measures, no electronic transmission or cloud storage is 100% secure. Therefore, we cannot guarantee absolute security of your data.
        </p>
      </section>
    </div>
  );
}

function RiskDisclosure() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-red-800 bg-clip-text text-transparent mb-2">Risk Disclosure</h2>
        <p className="text-red-400 text-sm italic font-bold tracking-widest uppercase">Important Warning - Read Carefully</p>
      </div>

      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl">
        <p className="text-red-200 leading-relaxed font-bold">
          Trading foreign exchange (Forex), commodities, and crypto assets on margin carries a high level of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you.
        </p>
      </div>

      <section>
        <h3 className="text-xl text-gold mb-3">3.1 Trading Risk Warning</h3>
        <p className="text-gray-300 leading-relaxed">
          Before deciding to trade in the foreign exchange market, you should carefully consider your investment objectives, level of experience, and risk appetite. The possibility exists that you could sustain a loss of some or all of your initial investment and therefore you should not invest money that you cannot afford to lose.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">3.2 No Financial Advice</h3>
        <p className="text-gray-300 leading-relaxed">
          <strong>SESSIONKING relies on algorithmic calculations and historical data. We are not financial advisors.</strong> The signals, technical analysis, news, and insights provided on this platform are for informational and educational purposes only and do not represent a solicitation to buy or sell any financial instrument.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">3.3 No Guarantee of Profit</h3>
        <p className="text-gray-300 leading-relaxed">
          Past performance of any trading system or methodology is not necessarily indicative of future results. Market dynamics shift, algorithms can fail, and no strategy guarantees continuous profitability.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">3.4 Market Volatility</h3>
        <p className="text-gray-300 leading-relaxed mb-2">Prices in financial markets can change rapidly and unpredictably due to:</p>
        <ul className="list-disc pl-5 space-y-2 text-gray-300">
          <li>Unexpected economic news and data releases.</li>
          <li>Central bank interventions and interest rate decisions.</li>
          <li>Global geopolitical events and liquidity gaps.</li>
        </ul>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">3.5 User Responsibility</h3>
        <p className="text-gray-300 leading-relaxed">
          The ultimate decision to place a trade lies entirely with the user. SESSIONKING, its founders, and its partners bare absolute zero liability for any financial losses or damages incurred resulting from the usage or reliance upon our platform's information.
        </p>
      </section>

      <section>
        <h3 className="text-xl text-gold mb-3">3.6 Technology Risks</h3>
        <p className="text-gray-300 leading-relaxed">
          Trading online carries technological risks including, but not limited to, hardware failures, software bugs, latency, network outages, and quote delays. We are not responsible for any losses arising from technical malfunctions on your end, broker issues, or our platform's server downtime.
        </p>
      </section>
    </div>
  );
}
