"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Captured at module load so we don't miss the event racing React mount.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    subscribers.forEach((notify) => notify());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    subscribers.forEach((notify) => notify());
  });
}

const SNOOZE_KEY = "traincore-install-snoozed-until";
const SNOOZE_DAYS = 14;

type InstallEnv = {
  standalone: boolean;
  ios: boolean;
};

function useInstallState() {
  const [, force] = useState(0);
  const [env, setEnv] = useState<InstallEnv | null>(null);

  useEffect(() => {
    const notify = () => force((n) => n + 1);
    subscribers.add(notify);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setEnv({ standalone, ios });
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  return { env, canPrompt: deferredPrompt !== null };
}

function useInstallActions() {
  const [guideOpen, setGuideOpen] = useState(false);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null; // a prompt event is single-use
      subscribers.forEach((notify) => notify());
      await prompt.prompt();
      await prompt.userChoice.catch(() => undefined);
    } else {
      setGuideOpen(true); // iOS or browsers without the install API
    }
  }, []);

  return { install, guideOpen, closeGuide: () => setGuideOpen(false) };
}

/** Dismissible bottom banner, shown app-wide until installed or snoozed. */
export function InstallBanner() {
  const { env, canPrompt } = useInstallState();
  const { install, guideOpen, closeGuide } = useInstallActions();
  const [snoozed, setSnoozed] = useState(true);

  useEffect(() => {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    setSnoozed(Date.now() < until);
  }, []);

  if (!env || env.standalone || snoozed) return null;
  if (!canPrompt && !env.ios) return null; // desktop / unsupported: stay quiet

  return (
    <>
      <div className="fixed inset-x-3 bottom-20 z-30 flex items-center gap-3 rounded-2xl border border-foreground/10 bg-background p-3.5 shadow-lg">
        <span className="text-2xl" aria-hidden>
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install traincore</p>
          <p className="text-xs text-foreground/60">
            Full screen, on your home screen — like a real app.
          </p>
        </div>
        <button
          onClick={() => void install()}
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-foreground transition active:scale-95"
        >
          Install
        </button>
        <button
          onClick={() => {
            localStorage.setItem(
              SNOOZE_KEY,
              String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000),
            );
            setSnoozed(true);
          }}
          className="shrink-0 p-1 text-foreground/40"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {guideOpen && <InstallGuide ios={env.ios} onClose={closeGuide} />}
    </>
  );
}

/** Persistent entry point (e.g. on the profile page) — ignores the snooze. */
export function InstallRow() {
  const { env, canPrompt } = useInstallState();
  const { install, guideOpen, closeGuide } = useInstallActions();

  if (!env || env.standalone) return null;

  return (
    <>
      <button
        onClick={() => void install()}
        className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4 text-left transition hover:border-foreground/25 active:scale-[0.99]"
      >
        <span className="text-2xl" aria-hidden>
          📲
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Install the app</span>
          <span className="block text-xs text-foreground/60">
            {canPrompt
              ? "One tap — adds traincore to your home screen."
              : "Add traincore to your home screen in a few taps."}
          </span>
        </span>
        <span className="text-foreground/30">›</span>
      </button>
      {guideOpen && <InstallGuide ios={env.ios} onClose={closeGuide} />}
    </>
  );
}

function InstallGuide({ ios, onClose }: { ios: boolean; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-foreground/20" />
        <h2 className="text-lg font-bold">Install traincore</h2>

        {ios ? (
          <ol className="mt-4 flex flex-col gap-4">
            <GuideStep n={1}>
              Tap the <strong>Share</strong> button
              <ShareIcon /> in the browser toolbar
            </GuideStep>
            <GuideStep n={2}>
              Scroll down and tap <strong>Add to Home Screen</strong>
              <PlusSquareIcon />
            </GuideStep>
            <GuideStep n={3}>
              Tap <strong>Add</strong> — traincore appears on your home screen
            </GuideStep>
          </ol>
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            <GuideStep n={1}>
              Open the browser menu (<strong>⋮</strong>)
            </GuideStep>
            <GuideStep n={2}>
              Tap <strong>Add to Home screen</strong> or <strong>Install app</strong>
            </GuideStep>
          </ol>
        )}

        <p className="mt-4 text-xs text-foreground/50">
          {ios
            ? "Don't see the option? Open traincore.fun in Safari first — in-app browsers (Instagram, etc.) can't install apps."
            : "Don't see the option? Open traincore.fun in Chrome first."}
        </p>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-foreground/15 py-3 text-sm font-semibold text-foreground/70"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function GuideStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
        {n}
      </span>
      <span className="text-sm leading-relaxed [&>svg]:mx-1 [&>svg]:inline [&>svg]:h-5 [&>svg]:w-5 [&>svg]:align-text-bottom">
        {children}
      </span>
    </li>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/70">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
