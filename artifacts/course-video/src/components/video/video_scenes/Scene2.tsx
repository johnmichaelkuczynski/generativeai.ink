import { motion } from 'framer-motion';

export function Scene2() {
  const words = [
    { text: "Compete.", delay: 1.2 },
    { text: "Cooperate.", delay: 2.1 },
    { text: "Choose partners.", delay: 3.0 },
    { text: "Protect family.", delay: 3.9 },
    { text: "Chase status.", delay: 4.8 },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-primary text-background"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col items-start justify-center gap-4 w-[80%]">
        {words.map((w, i) => (
          <motion.div
            key={i}
            className="overflow-hidden"
          >
            <motion.h2
              className="text-[12cqi] font-serif font-semibold italic text-background"
              initial={{ y: '100%', opacity: 0, rotate: 2 }}
              animate={{ y: '0%', opacity: 1, rotate: 0 }}
              transition={{ delay: w.delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {w.text}
            </motion.h2>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
