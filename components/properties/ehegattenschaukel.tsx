import { CSSProperties } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { calcEhegattenschaukelPotential } from '@/lib/afa'
import { euro } from '@/lib/format'
import { Property } from '@/lib/types'

// Je größer das AfA-Potenzial relativ zur bisherigen AfA, desto stärker und
// schneller schaukelt es - kleines Potenzial bleibt fast still.
function swingIntensity(currentAnnualAfa: number, deltaAnnualAfa: number) {
  const ratio = currentAnnualAfa > 0 ? deltaAnnualAfa / currentAnnualAfa : (deltaAnnualAfa > 0 ? 1 : 0)
  const amplitude = Math.max(3, Math.min(28, ratio * 45))
  const duration = Math.max(2.4, 4.6 - ratio * 2)
  return { amplitude, duration }
}

export function Ehegattenschaukel({ property }: { property: Property }) {
  const potential = calcEhegattenschaukelPotential(property)
  const hasPotential = potential.delta_annual_afa > 100
  const { amplitude, duration } = swingIntensity(potential.current_annual_afa, potential.delta_annual_afa)

  return (
    <Card>
      <CardTitle>Ehegattenschaukel-Potenzial</CardTitle>
      <p className="text-xs text-gray-400 mt-1 mb-2">
        Verkauf an den Ehepartner zum aktuellen Marktwert kann AfA-Bemessungsgrundlage und Restnutzungsdauer neu starten lassen.
        Grunderwerbsteuer ist unter Ehegatten idR befreit (§3 Nr. 4 GrEStG), Notar-/Grundbuchkosten fallen trotzdem an - nur mit Steuerberater final prüfen.
      </p>

      <div className="relative w-56 h-28 mx-auto my-2">
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-b-[22px] border-b-gray-300" />
        <div className="absolute left-1/2 bottom-[26px] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-gray-400 z-10" />
        <div
          className="ehegattenschaukel-plank absolute left-1/2 bottom-[26px] -translate-x-1/2 w-44 h-2"
          style={{ '--amp': `${amplitude}deg`, animationDuration: `${duration}s` } as CSSProperties}
        >
          <div className="absolute inset-0 bg-amber-700 rounded-full" />
          <span className="absolute -left-1 -top-7 text-2xl select-none">🧔</span>
          <span className="absolute -right-1 -top-7 text-2xl select-none">👩</span>
        </div>
      </div>

      {hasPotential ? (
        <div className="text-sm text-center space-y-1">
          <p className="text-gray-600">
            Aktuell <strong className="text-gray-900">{euro(potential.current_annual_afa)}</strong> AfA/Jahr
            {' '}&rarr; nach Schaukel potenziell <strong className="text-green-700">{euro(potential.potential_annual_afa)}</strong> AfA/Jahr
          </p>
          <p className="text-green-700 font-semibold">
            +{euro(potential.delta_annual_afa)} mehr AfA pro Jahr (neue Restnutzungsdauer {potential.new_usage_duration} Jahre)
          </p>
        </div>
      ) : (
        <p className="text-sm text-center text-gray-400">
          Aktuell kaum Potenzial - der Marktwert liegt nah am ursprünglich abgeschriebenen Kaufpreis, eine Schaukel würde die AfA kaum erhöhen.
        </p>
      )}
    </Card>
  )
}
