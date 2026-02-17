"use client";

import { useEffect, useState } from "react";

interface ConfettiProps {
  trigger: boolean;
  intensity?: "low" | "medium" | "high";
}

const COLORS = [
  "oklch(0.7 0.18 145)", // green
  "oklch(0.7 0.15 205)", // blue
  "oklch(0.75 0.16 65)",  // amber
  "oklch(0.65 0.18 330)", // pink
  "oklch(0.7 0.14 280)",  // violet
  "oklch(0.8 0.12 100)",  // yellow
];

const COUNT: Record<string, number> = { low: 20, medium: 40, high: 60 };

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

export function Confetti({ trigger, intensity = "medium" }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const count = COUNT[intensity];
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 600,
      duration: 1200 + Math.random() * 1800,
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
    }));

    setParticles(newParticles);

    const timer = setTimeout(() => setParticles([]), 3500);
    return () => clearTimeout(timer);
  }, [trigger, intensity]);

  if (particles.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.2}px`,
            backgroundColor: p.color,
            borderRadius: p.size > 7 ? "2px" : "50%",
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${p.duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}
