import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Lê um valor que só existe no navegador (userAgent, display-mode…) sem
 * causar divergência de hidratação: no servidor devolve `serverValue`.
 * Para valores que mudam ao longo do tempo, use um store com subscribe.
 */
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, getClientValue, () => serverValue);
}

export const isStandaloneDisplay = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);

export const isIOSDevice = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
