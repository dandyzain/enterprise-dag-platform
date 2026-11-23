"use client";

import { motion } from "motion/react";
import { duration, ease } from "@/components/motion/presets";

/** Route transition: content fades in with a short rise; the shell stays put. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: ease.emphasized }}
    >
      {children}
    </motion.div>
  );
}
