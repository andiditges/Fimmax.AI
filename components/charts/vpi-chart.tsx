'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDate } from '@/lib/format'
import { useTheme } from '@/components/theme/theme-provider'

interface Point {
  month: string
  value: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-400 dark:text-gray-500">{formatDate(point.month)}</p>
      <p className="font-semibold text-gray-900 dark:text-gray-100">{point.value.toFixed(3)}</p>
    </div>
  )
}

export function VpiChart({ data }: { data: Point[] }) {
  const { theme } = useTheme()
  const gridStroke = theme === 'dark' ? '#374151' : '#f3f4f6'
  const tickFill = theme === 'dark' ? '#6b7280' : '#9ca3af'

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">Noch keine Indexstände hinterlegt.</p>
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke={gridStroke} />
          <XAxis
            dataKey="month"
            tickFormatter={d => new Date(d).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })}
            tick={{ fontSize: 11, fill: tickFill }}
            axisLine={{ stroke: gridStroke }}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            domain={['dataMin - 1', 'dataMax + 1']}
            tick={{ fontSize: 11, fill: tickFill }}
            axisLine={false}
            tickLine={false}
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
