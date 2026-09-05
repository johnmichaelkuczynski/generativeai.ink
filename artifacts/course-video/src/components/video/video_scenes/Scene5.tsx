import { motion } from 'framer-motion';

export function Scene5() {
  return (
    <motion.div
      className="absolute inset-0 bg-background overflow-hidden flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <motion.div
        className="absolute inset-0 origin-center"
        initial={{ scale: 1.6, y: '10%', x: '-15%' }}
        animate={{ scale: 1.1, y: '-5%', x: '5%' }}
        transition={{ duration: 7.1, ease: 'easeOut' }}
      >
        <img
          src={`${import.meta.env.BASE_URL}screenshots/assignments.jpg`}
          alt="Assignments View"
          className="w-full h-full object-cover"
          style={{ objectPosition: 'top left' }}
        />
      </motion.div>

      {/* Floating Labels */}
      <div className="absolute inset-0 p-8 flex flex-col justify-center gap-12 z-10 pointer-events-none">
        <motion.div
          className="bg-primary/95 text-primary-foreground backdrop-blur-md self-start px-6 py-4 rounded-2xl shadow-xl border border-white/20"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.5, duration: 0.8, type: 'spring' }}
        >
          <p className="font-sans font-bold text-[7cqi]">Section-Scoped Tutor</p>
        </motion.div>

        <motion.div
          className="bg-primary/95 text-primary-foreground backdrop-blur-md self-start ml-12 px-6 py-4 rounded-2xl shadow-xl border border-white/20"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 3.0, duration: 0.8, type: 'spring' }}
        >
          <p className="font-sans font-bold text-[7cqi]">Adaptive Practice</p>
        </motion.div>
        
        <motion.div
          className="bg-primary text-primary-foreground self-start px-6 py-4 rounded-2xl shadow-xl border border-white/10"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 4.5, duration: 0.8, type: 'spring' }}
        >
          <p className="font-sans font-bold text-[7cqi]">AI-Graded Work</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
