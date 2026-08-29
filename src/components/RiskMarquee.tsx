import React, { memo } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

const RiskMarquee = memo(function RiskMarquee() {
  return (
    <div className="w-full overflow-hidden bg-matte-black border-y border-gold/20 py-2 mt-12 relative flex items-center">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-matte-black to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-matte-black to-transparent z-10 pointer-events-none" />
      
      <motion.div
        className="flex whitespace-nowrap items-center gap-8"
        animate={{ x: [0, -1000] }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 20,
            ease: "linear",
          },
        }}
      >
        {/* Repeat the content multiple times to ensure smooth looping */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 text-gold/80 text-xs font-medium uppercase tracking-widest">
            <AlertTriangle className="w-4 h-4 text-gold" />
            <span>Trading involves risk. Never risk more than 1% per trade. No guaranteed profits. Capital preservation is priority.</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
});

export default RiskMarquee;
