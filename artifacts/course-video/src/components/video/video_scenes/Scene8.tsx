import { motion } from 'framer-motion';

export function Scene8() {
  const text = 'evopsychfourhour.xyz';
  
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div 
        className="text-center px-8"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 3.2, ease: 'easeOut' }}
      >
        <h1 className="text-[9.5cqi] font-serif font-semibold text-primary tracking-tight leading-none overflow-hidden">
          {text.split('').map((char, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: '0%' }}
              transition={{ delay: i * 0.03 + 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {char}
            </motion.span>
          ))}
        </h1>
      </motion.div>
      <motion.div
        className="absolute bottom-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
      >
        <div className="w-12 h-1 bg-primary rounded-full" />
      </motion.div>
    </motion.div>
  );
}
