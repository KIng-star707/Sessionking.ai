import React from 'react';
import { motion } from 'motion/react';

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "w-8 h-8", showText = false }) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className}`}>
      <div className="relative w-full h-full flex items-center justify-center">
         <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="absolute inset-0 rounded-full border border-dashed border-blue-500/50"
         />
         <motion.div 
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
            className="absolute inset-1 rounded-full border border-purple-500/30 border-t-purple-500"
         />
         <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-1/3 h-1/3 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)]"
         />
      </div>
      
      {showText && (
        <div className="text-center mt-2">
           <div className="text-2xl font-black tracking-widest flex items-center justify-center">
             <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">SESSION</span>
             <span className="text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]">KING</span>
           </div>
           <div className="text-[10px] text-gray-400 font-bold tracking-[0.3em] mt-1">
              ALGORITHMIC INTELLIGENCE
           </div>
        </div>
      )}
    </div>
  );
};
