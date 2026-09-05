import { motion } from 'framer-motion';

export function Scene6() {
  return (
    <motion.div
      className="absolute inset-0 bg-background overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="absolute inset-0 origin-center"
        initial={{ scale: 2.2, y: '30%', x: '20%' }}
        animate={{ scale: 1, y: '0%', x: '0%' }}
        transition={{ duration: 6.4, ease: 'easeOut' }}
      >
        <img
          src={`${import.meta.env.BASE_URL}screenshots/grades.jpg`}
          alt="Grades View"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center' }}
        />
      </motion.div>

      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 pointer-events-none">
        <motion.div
          className="bg-primary/95 backdrop-blur text-primary-foreground p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-center border border-white/20"
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 1, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <motion.div 
            className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 2.0, type: 'spring' }}
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
          <h2 className="font-serif text-[10cqi] leading-tight font-bold">
            Evolutionary<br />Psychology
          </h2>
          <div className="uppercase tracking-[0.2em] text-[4cqi] font-sans font-semibold text-white/70 mt-2">
            Level One Certificate
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
