'use client'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { euro } from '@/lib/format'

interface Point {
  year: number
  amount: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: Point }[] }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-3 py-2 text-xs">
      <p className="text-gray-400">{point.year}</p>
      <p className="font-semibold text-gray-900">{euro(point.amount)}</p>
    </div>
  )
}

export function CapexChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">Keine Renovierungs-/Sanierungsbelege erfasst.</p>
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={{ stroke: '#f3f4f6' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => `${Math.round(v / 1000)}k`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
          <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
