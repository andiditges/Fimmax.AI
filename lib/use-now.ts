'use client'

import { useSyncExternalStore } from 'react'

function subscribe(intervalMs: number) {
  return (callback: () => void) => {
    const id = setInterval(callback, intervalMs)
    return () => clearInterval(id)
  }
}

function getServerSnapshot(): number | null {
  return null
}

/**
 * Live-tickende "Uhrzeit" für rein clientseitige Echtzeit-Widgets (z.B.
 * Rentenuhr, Countdown bis zur finanziellen Unabhängigkeit). Über
 * useSyncExternalStore statt setInterval+useState im Effekt, damit React
 * die Subscription selbst verwaltet (kein setState direkt im Effekt-Body)
 * und der Server ohne zeitabhängigen Inhalt rendert - erst nach der
 * Hydration liefert getSnapshot einen echten Timestamp, davor null.
 */
export function useNow(intervalMs = 1000): Date | null {
  const ms = useSyncExternalStore(subscribe(intervalMs), () => Date.now(), getServerSnapshot)
  return ms === null ? null : new Date(ms)
}
