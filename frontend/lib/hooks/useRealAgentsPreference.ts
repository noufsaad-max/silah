"use client";

import { useEffect, useState } from "react";

/**
 * "Use real agents" used to be separate, page-local state (new product form,
 * results page, prospect detail page) that always started back at `false`.
 * That meant a run started with real agents could still get its outreach
 * drafted by the mock agent on the next page, with nothing on screen telling
 * you that happened -- see the "messages should be from agent 3" report.
 *
 * This hook makes the choice a single, shared preference that persists (via
 * localStorage) across the whole app, so once someone turns real agents on,
 * every subsequent draft/discover call keeps using them until they turn it
 * back off -- instead of silently resetting per page.
 */
const STORAGE_KEY = "silah:useRealAgents";

export function useRealAgentsPreference(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setValue(stored === "true");
    } catch {
      // localStorage unavailable (private browsing, disabled, etc.) -- fall
      // back to the in-memory default and just don't persist.
    }
  }, []);

  function update(next: boolean) {
    setValue(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // best-effort persistence only
    }
  }

  return [value, update];
}
