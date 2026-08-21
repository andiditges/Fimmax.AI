'use client'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { euro } from '@/lib/format'
import { useTheme } from '@/components/theme/theme-provider'
import { usePrivacyMode } from '@/components/privacy/privacy-mode-context'
import { fakeAmount } from '@/lib/privacy'

interface Point {
  year: number
  amount: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-400 dark:text-gray-500">{point.year}</p>
      <p className="font-semibold text-gray-900 dark:text-gray-100">{euro(point.amount)}</p>
    </div>
  )
}

export function CapexChart({ data }: { data: Point[] }) {
  const { theme } = useTheme()
  const { enabled: privacyEnabled } = usePrivacyMode()
  const gridStroke = theme === 'dark' ? '#374151' : '#f3f4f6'
  const tickFill = theme === 'dark' ? '#6b7280' : '#9ca3af'

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Keine Renovierungs-/Sanierungsbelege erfasst.</p>
  }

  const chartData = privacyEnabled
    ? data.map(d => ({ ...d, amount: fakeAmount('capex', d.amount) }))
    : data

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridStroke} />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: tickFill }}
            axisLine={{ stroke: gridStroke }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => `${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11, fill: tickFill }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: gridStroke }} />
          <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
