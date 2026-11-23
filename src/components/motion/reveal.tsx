"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { fadeUp, staggerContainer } from "./presets";

/** Fades/rises children into view once. */
export function Reveal({ children, delay = 0, ...props }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      variants={{
        hidden: fadeUp.hidden,
        show: { ...fadeUp.show, transition: { ...fadeUp.show.transition, delay } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Staggers direct <RevealItem> children. */
export function RevealGroup({ children, stagger = 0.04, ...props }: HTMLMotionProps<"div"> & { stagger?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      variants={staggerContainer(stagger)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={fadeUp} {...props}>
      {children}
    </motion.div>
  );
}

/** Pointer-tracking CSS vars for the `.spotlight` utility. */
export function useSpotlight<T extends HTMLElement>() {
  return React.useCallback((e: React.PointerEvent<T>) => {
    if (e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }, []);
}
