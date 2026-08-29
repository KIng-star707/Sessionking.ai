import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isMarketWeekend = () => {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  // Forex market closes Friday 22:00 UTC and opens Sunday 22:00 UTC
  // 0 is Sunday, 6 is Saturday
  if (day === 6) return true; // Saturday
  if (day === 5 && hour >= 22) return true; // Friday after 22:00 UTC
  if (day === 0 && hour < 22) return true;  // Sunday before 22:00 UTC
  return false;
};
