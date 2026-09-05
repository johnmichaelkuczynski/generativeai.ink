import { motion } from 'framer-motion';

export function Scene3() {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Background decoration */}
      <motion.div 
        className="absolute inset-0 bg-accent/5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 2 }}
      />

      <motion.div
        className="relative w-[90%] h-[60%] perspective-[1000px] flex items-center justify-center"
      >
        <motion.img
          src={`${import.meta.env.BASE_URL}screenshots/live-home.png`}
          alt="Home Screen"
          className="absolute w-full h-full object-cover rounded-2xl shadow-2xl shadow-primary/20"
          style={{ transformOrigin: 'bottom center', objectPosition: 'top center' }}
          initial={{ y: '50vh', rotateX: 20, scale: 0.8, opacity: 0 }}
          animate={{ y: 0, rotateX: 0, scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
        
        {/* Floating Accent Badge */}
        <motion.div
          className="absolute -top-6 -left-4 bg-primary text-primary-foreground px-6 py-4 rounded-xl shadow-xl border border-white/10"
          initial={{ scale: 0, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 5 }}
          transition={{ delay: 2.2, type: 'spring', stiffness: 300, damping: 20 }}
        >
          <span className="block font-sans font-bold text-[7cqi] tracking-tight">
            4–6 Hours
          </span>
          <span className="block font-serif italic text-[4cqi] text-primary-foreground/80 mt-1">
            Rigorous Course
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
