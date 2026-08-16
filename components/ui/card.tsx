import { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 break-words ${className}`}>{children}</h2>
}
