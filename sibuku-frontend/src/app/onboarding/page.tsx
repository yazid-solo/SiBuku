"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";

type Step = { title: string; desc: string };

export default function OnboardingPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const reduceMotion = useReducedMotion();

  const steps: Step[] = useMemo(
    () => [
      { title: "Selamat datang di SiBuku", desc: "Cari buku, masuk keranjang, lalu checkout dengan cepat." },
      { title: "Checkout lebih otomatis", desc: "Profil + alamat kamu dipakai otomatis saat checkout." },
      { title: "Pantau pesanan", desc: "Status pembayaran & pengiriman bisa kamu cek di menu Pesanan." },
    ],
    []
  );

  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1); // arah animasi
  const last = i === steps.length - 1;

  const progress = Math.round(((i + 1) / steps.length) * 100);

  async function finish() {
    await fetch("/api/onboarding/complete", { method: "POST" }).catch(() => null);
    router.replace(next);
    router.refresh();
  }

  function goNext() {
    if (last) return finish();
    setDir(1);
    setI((v) => Math.min(steps.length - 1, v + 1));
  }

  function goPrev() {
    setDir(-1);
    setI((v) => Math.max(0, v - 1));
  }

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * 28, y: reduceMotion ? 0 : 2, filter: "blur(2px)" }),
    center: { opacity: 1, x: 0, y: 0, filter: "blur(0px)" },
    exit: (d: number) => ({ opacity: 0, x: reduceMotion ? 0 : d * -28, y: reduceMotion ? 0 : -2, filter: "blur(2px)" }),
  };

  return (
    <div className="container py-12">
      <Reveal>
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-black">Onboarding</h1>
            <p className="text-white/60 mt-1">Sebentar saja biar pengalaman belanjanya makin enak.</p>
          </div>

          <Card className="relative overflow-hidden">
            {/* glow background halus */}
            <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative">
              {/* header small */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/50">
                  Step {i + 1} / {steps.length}
                </div>
                <button
                  className="text-xs text-white/60 hover:text-white transition"
                  type="button"
                  onClick={finish}
                >
                  Lewati →
                </button>
              </div>

              {/* progress bar anim */}
              <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400/80 to-sky-300/80"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <div className="mt-1 text-[11px] text-white/45">{progress}%</div>

              {/* content anim */}
              <div className="mt-5 min-h-[110px]">
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div
                    key={i}
                    custom={dir}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      duration: reduceMotion ? 0 : 0.24,
                      ease: "easeOut",
                    }}
                  >
                    <div className="text-lg font-extrabold">{steps[i].title}</div>
                    <div className="text-sm text-white/70 mt-2">{steps[i].desc}</div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* dots */}
              <div className="mt-4 flex gap-2 justify-center">
                {steps.map((_, idx) => (
                  <motion.span
                    key={idx}
                    className="h-2 w-2 rounded-full bg-white/15"
                    animate={{
                      backgroundColor: idx === i ? "rgba(165,180,252,1)" : "rgba(255,255,255,0.15)",
                      scale: idx === i ? 1.2 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  />
                ))}
              </div>

              {/* actions */}
              <div className="mt-6 flex gap-2">
                <Button variant="secondary" disabled={i === 0} onClick={goPrev}>
                  Kembali
                </Button>

                <Button className="flex-1" onClick={goNext}>
                  {last ? "Mulai Belanja" : "Lanjut"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}