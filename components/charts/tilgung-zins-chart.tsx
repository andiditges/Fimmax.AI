'use client'
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { euro, formatDate } from '@/lib/format'

interface Point {
  date: string
  interest: number
  principal: number
  remaining_balance: number
  progress: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-2 text-xs space-y-0.5">
      <p className="text-gray-400">{formatDate(point.date)}</p>
      <p className="text-red-500">Zinsen: <strong>{euro(point.interest)}</strong></p>
      <p className="text-green-600">Tilgung: <strong>{euro(point.principal)}</strong></p>
    </div>
  )
}

interface HoverState {
  x: number
  y: number
  progress: number
  payoff: boolean
}

// Mundkurve wächst mit dem Fortschritt (1 - Restschuld/Darlehenssumme); bei
// vollständiger Tilgung kommt zusätzlich eine Krone über den Kopf.
function SmileyOverlay({ hover }: { hover: HoverState }) {
  const mouthDip = 4 + hover.progress * 13

  return (
    <div
      className="pointer-events-none absolute z-10 transition-[left,top] duration-75 ease-out"
      style={{ left: hover.x, top: hover.y - 44, transform: 'translate(-50%, -100%)' }}
    >
      <svg width="48" height="56" viewBox="-24 -28 48 56">
        {hover.payoff && (
          <path
            d="M -13,-21 L -7,-11 L 0,-24 L 7,-11 L 13,-21 L 11,-13 L -11,-13 Z"
            fill="#f59e0b" stroke="#b45309" strokeWidth={1}
          />
        )}
        <circle cx="0" cy="0" r="15" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
        <circle cx="-5.5" cy="-3.5" r="1.8" fill="#78350f" />
        <circle cx="5.5" cy="-3.5" r="1.8" fill="#78350f" />
        <path
          d={`M -7,3 Q 0,${3 + mouthDip} 7,3`}
          stroke="#78350f" strokeWidth="1.8" fill="none" strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export function TilgungZinsChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<HoverState | null>(null)

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Keine Daten für den Verlauf.</p>
  }

  return (
    <div className="relative h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 40, right: 8, bottom: 0, left: 0 }}
          onMouseMove={(state) => {
            const index = Number(state?.activeTooltipIndex)
            if (state?.isTooltipActive && state.activeCoordinate && Number.isInteger(index)) {
              const point = data[index]
              if (point) {
                setHover({
                  x: state.activeCoordinate.x,
                  y: state.activeCoordinate.y,
                  progress: point.progress,
                  payoff: point.remaining_balance <= 0.01,
                })
              }
            }
          }}
          onMouseLeave={() => setHover(null)}
        >
          <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="date"
            tickFormatter={d => new Date(d).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={{ stroke: '#f3f4f6' }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={v => euro(v)}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="interest" name="Zinsen" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
          <Line type="monotone" dataKey="principal" name="Tilgung" stroke="#16a34a" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#16a34a', stroke: '#fff', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
      {hover && <SmileyOverlay hover={hover} />}
      <div className="flex items-center gap-4 text-xs text-gray-400 mt-1 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Zinsen</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" /> Tilgung</span>
        <span className="text-gray-300">· zum Durchhovern: das Gesicht freut sich mehr, je weiter der Kredit getilgt ist</span>
      </div>
    </div>
  )
}
