"use client";

import { useEffect } from "react";
import { InstallBanner } from "@/components/InstallApp";

/** Registers the service worker (production only) and mounts the
 *  app-wide install banner. */
export default function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return <InstallBanner />;
}
