'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { euro, formatDate } from '@/lib/format'

interface Point {
  date: string
  daily_interest: number
  daily_principal: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-2 text-xs space-y-0.5">
      <p className="text-gray-400">{formatDate(point.date)}</p>
      <p className="text-blue-600">Zinsen/Tag: <strong>{euro(point.daily_interest)}</strong></p>
      <p className="text-green-600">Tilgung/Tag: <strong>{euro(point.daily_principal)}</strong></p>
    </div>
  )
}

export function DailyTilgungChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Keine Daten für den Verlauf.</p>
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          <Line type="monotone" dataKey="daily_interest" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} />
          <Line type="monotone" dataKey="daily_principal" stroke="#16a34a" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#16a34a', stroke: '#fff', strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
