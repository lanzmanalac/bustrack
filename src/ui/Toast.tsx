import { AnimatePresence, motion } from 'motion/react';

export function Toast({ message }: { message: string | null }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            className="rounded-full bg-[var(--ink)] px-4 py-2.5 text-[0.9375rem] font-semibold text-white shadow-lg"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
