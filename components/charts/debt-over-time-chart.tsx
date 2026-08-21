'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { euro, formatDate } from '@/lib/format'
import { useTheme } from '@/components/theme/theme-provider'
import { usePrivacyMode } from '@/components/privacy/privacy-mode-context'
import { fakeAmount } from '@/lib/privacy'

interface Point {
  date: string
  remaining_balance: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-400 dark:text-gray-500">{formatDate(point.date)}</p>
      <p className="font-semibold text-gray-900 dark:text-gray-100">{euro(point.remaining_balance)}</p>
    </div>
  )
}

export function DebtOverTimeChart({ data }: { data: Point[] }) {
  const { theme } = useTheme()
  const { enabled: privacyEnabled } = usePrivacyMode()
  const gridStroke = theme === 'dark' ? '#374151' : '#f3f4f6'
  const tickFill = theme === 'dark' ? '#6b7280' : '#9ca3af'

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Keine Daten für den Verlauf.</p>
  }

  // Gleicher Seed für jeden Punkt der Reihe: skaliert die komplette Kurve
  // um denselben Faktor, damit Achse/Tooltip/Kurvenform im Privacy-Modus
  // konsistent zueinander bleiben (statt jeden Punkt einzeln zu verzerren).
  const chartData = privacyEnabled
    ? data.map(d => ({ ...d, remaining_balance: fakeAmount('debt-over-time', d.remaining_balance) }))
    : data

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridStroke} />
          <XAxis
            dataKey="date"
            tickFormatter={d => new Date(d).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })}
            tick={{ fontSize: 11, fill: tickFill }}
            axisLine={{ stroke: gridStroke }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={v => `${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11, fill: tickFill }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="remaining_balance"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
