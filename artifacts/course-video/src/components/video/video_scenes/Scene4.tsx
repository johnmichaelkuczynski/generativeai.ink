import { motion } from 'framer-motion';

export function Scene4() {
  const topics = [
    { text: "Foundations of Behavior", delay: 1.0 },
    { text: "Natural & Sexual Selection", delay: 3.0 },
    { text: "Mating & Kin Selection", delay: 5.0 },
    { text: "Parenting & Family", delay: 7.0 },
    { text: "Cooperation & Exchange", delay: 9.0 },
    { text: "Cognitive Psychology", delay: 11.0 },
  ];

  return (
    <motion.div
      className="absolute inset-0 bg-background overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {/* The sliding screenshot - SHARP and PROMINENT */}
        <motion.div 
          className="absolute origin-top-left left-0 top-0"
          style={{ width: '180%', height: '300%' }}
          initial={{ x: '-15%', y: '0%', scale: 1.0 }}
          animate={{ x: '-15%', y: '-60%', scale: 1.0 }}
          transition={{ duration: 13, ease: 'linear' }}
        >
          <img
            src={`${import.meta.env.BASE_URL}screenshots/live-home.png`}
            alt="Topics Sidebar"
            className="w-full h-full object-cover shadow-2xl"
            style={{ objectPosition: 'top left' }}
          />
        </motion.div>
        
        {/* Overlay: Dynamic typography in a beautiful readable panel */}
        <div className="absolute inset-x-8 bottom-[25%] flex flex-col justify-end items-start pointer-events-none">
          <div className="flex flex-col gap-4 w-full">
            {topics.map((t, i) => (
              <motion.div
                key={i}
                className="bg-primary/95 backdrop-blur-md px-6 py-4 rounded-xl shadow-2xl border border-white/20 self-start max-w-[90%]"
                initial={{ x: '-120%', opacity: 0 }}
                animate={{ x: '0%', opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: t.delay, duration: 0.8, type: 'spring', damping: 20 }}
              >
                <div className="font-sans text-[7cqi] leading-tight text-primary-foreground font-bold tracking-tight">
                  {t.text}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
