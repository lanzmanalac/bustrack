import { AnimatePresence, motion } from 'motion/react';

/** Rolls between values instead of jumping. Decorative: pair it with an aria-live text. */
export function RollingNumber({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span aria-hidden className={`relative inline-flex overflow-hidden ${className}`}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="inline-block"
          initial={{ y: '-55%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '55%', opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
