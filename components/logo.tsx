export function Logo() {
  return (
    <span className="leading-tight inline-block">
      <span className="font-bold text-blue-700 text-2xl tracking-tight block whitespace-nowrap">
        F<span className="brick-text">i</span><span className="brick-text relative inline-block align-baseline">
          <svg className="absolute left-0 top-[0.3em] w-full aspect-[100/13.4]" viewBox="0 0 100 13.4" aria-hidden="true">
            <path d="M0,13.4 L50,0 L100,13.4" fill="none" stroke="#8f3a1a" strokeWidth="1.15" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          mm
        </span>ax.AI
      </span>
      <span className="text-xs text-gray-400 block -mt-0.5">KI-gestützt. Maximal effizient.</span>
    </span>
  )
}
