'use client'

import { useRef, useSyncExternalStore } from 'react'

interface NowStore {
  intervalMs: number
  value: number
  listeners: Set<() => void>
  intervalId: ReturnType<typeof setInterval> | null
  subscribe: (callback: () => void) => () => void
  getSnapshot: () => number
}

function createNowStore(intervalMs: number): NowStore {
  const store: NowStore = {
    intervalMs,
    value: Date.now(),
    listeners: new Set(),
    intervalId: null,
    subscribe(callback) {
      store.listeners.add(callback)
      if (store.intervalId === null) {
        store.intervalId = setInterval(() => {
          store.value = Date.now()
          store.listeners.forEach((l) => l())
        }, intervalMs)
      }
      return () => {
        store.listeners.delete(callback)
        if (store.listeners.size === 0 && store.intervalId !== null) {
          clearInterval(store.intervalId)
          store.intervalId = null
        }
      }
    },
    getSnapshot() {
      return store.value
    },
  }
  return store
}

function getServerSnapshot(): number | null {
  return null
}

/**
 * Live-tickende "Uhrzeit" für rein clientseitige Echtzeit-Widgets (z.B.
 * Rentenuhr, Countdown bis zur finanziellen Unabhängigkeit). getSnapshot
 * MUSS zwischen Aufrufen denselben Wert liefern, solange sich der Store
 * nicht geändert hat (Contract von useSyncExternalStore) - ein direktes
 * Date.now() als getSnapshot (frühere Version) verletzte das, weil zwei
 * Aufrufe kurz hintereinander (Render + Tearing-Check) unterschiedliche
 * Millisekunden liefern konnten. React erkannte das als "Store hat sich
 * geändert" und rendert sofort neu - in Dauerschleife, sichtbar als
 * "Maximum update depth exceeded" (React #185), auf langsamer Hardware
 * (Mobile) besonders leicht reproduzierbar. Der Wert wird jetzt gecacht
 * und nur beim tatsächlichen Interval-Tick aktualisiert.
 */
export function useNow(intervalMs = 1000): Date | null {
  const storeRef = useRef<NowStore | null>(null)
  if (storeRef.current === null || storeRef.current.intervalMs !== intervalMs) {
    storeRef.current = createNowStore(intervalMs)
  }

  const ms = useSyncExternalStore(storeRef.current.subscribe, storeRef.current.getSnapshot, getServerSnapshot)
  return ms === null ? null : new Date(ms)
}
