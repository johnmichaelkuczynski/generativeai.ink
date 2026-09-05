import { motion } from 'framer-motion';

export function Scene7() {
  const clients = [
    { label: "Colleges", delay: 4.0 },
    { label: "Individuals", delay: 5.0 },
    { label: "Banks", delay: 6.0 },
    { label: "Organizations", delay: 7.0 },
  ];

  return (
    <motion.div
      className="absolute inset-0 bg-primary text-primary-foreground flex flex-col items-center justify-center p-12"
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: '0%' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="flex flex-col items-center gap-6 mb-16"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.0, duration: 1 }}
      >
        <motion.div 
          className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-2xl"
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ delay: 1.5, type: 'spring', damping: 15 }}
        >
          <img src={`${import.meta.env.BASE_URL}zhi-systems-logo.png`} alt="ZHI Systems" className="w-16 h-16 object-contain" />
        </motion.div>
        <h2 className="font-serif text-[12cqi] font-bold tracking-tight">ZHI Systems</h2>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 w-full">
        {clients.map((c, i) => (
          <motion.div
            key={i}
            className="border border-white/20 bg-white/5 rounded-xl p-6 flex items-center justify-center text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: c.delay, duration: 0.6, type: 'spring' }}
          >
            <span className="font-sans font-semibold uppercase tracking-wider text-[4cqi] text-white/90">
              {c.label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
