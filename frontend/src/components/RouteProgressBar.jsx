import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { PAGE_TRANSITION_DURATION_MS } from './PageTransition';

export default function RouteProgressBar() {
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const timeoutRef = useRef(null);

  const width = useMotionValue(0);
  const opacity = useMotionValue(0);

  const smoothWidth = useSpring(width, { stiffness: 200, damping: 25, mass: 0.5 });
  const smoothOpacity = useSpring(opacity, { stiffness: 200, damping: 25 });

  useEffect(() => {
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // 1. Show bar and jump to 30%
    opacity.set(1);
    width.set(30);

    // 2. After a tick, creep to 60%
    const t1 = setTimeout(() => width.set(60), 80);

    // 3. Fill to 100% after transition, then fade
    timeoutRef.current = setTimeout(() => {
      width.set(100);
      setTimeout(() => {
        opacity.set(0);
        setTimeout(() => width.set(0), 250);
      }, 200);
    }, PAGE_TRANSITION_DURATION_MS);

    return () => {
      clearTimeout(t1);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [location.pathname]);

  const barScaleX = useTransform(smoothWidth, [0, 100], [0, 1]);

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none"
      style={{ opacity: smoothOpacity }}
    >
      <motion.div
        className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-cyan-400"
        style={{ scaleX: barScaleX, transformOrigin: 'left center' }}
      />
    </motion.div>
  );
}
