import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True after hydration on the client; false during SSR and hydration. */
export function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** The browser's IANA timezone (falls back to UTC during SSR). */
export function useBrowserTimezone() {
  return useSyncExternalStore(
    subscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => "UTC",
  );
}
