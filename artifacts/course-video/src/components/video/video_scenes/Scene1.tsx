import { motion } from 'framer-motion';

export function Scene1() {
  const text = 'evopsychfourhour.xyz';
  
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div 
        className="text-center px-8"
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 4.5, ease: 'linear' }}
      >
        <motion.h1 
          className="text-[9.5cqi] font-serif font-semibold text-primary tracking-tight leading-none"
        >
          {text.split('').map((char, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 + 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {char}
            </motion.span>
          ))}
        </motion.h1>
      </motion.div>
    </motion.div>
  );
}
