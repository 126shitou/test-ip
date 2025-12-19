"use client";

import { useEffect, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

type Props = {
  /**
   * Called when visitorId is available.
   * If omitted, defaults to console.log.
   */
  onVisitorId?: (visitorId: string) => void;
};

export default function FingerprintVisitorId({ onVisitorId }: Props) {
  const [visitorId, setVisitorId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        if (cancelled) return;

        const id = result.visitorId;
        setVisitorId(id);
        if (onVisitorId) onVisitorId(id);
        else console.log(id);
      } catch (err) {
        // Keep behavior non-fatal; fingerprinting can fail due to CSP/adblock/etc.
        console.warn("FingerprintJS failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onVisitorId]);

  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-md border border-zinc-200 bg-white/90 px-3 py-2 text-xs text-zinc-900 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-black/70 dark:text-zinc-100">
      <div className="font-medium">visitorId</div>
      <div className="mt-0.5 font-mono">
        {visitorId ?? <span className="text-zinc-500">loading…</span>}
      </div>
    </div>
  );
}


