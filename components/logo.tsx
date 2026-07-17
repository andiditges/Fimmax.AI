export function Logo() {
  return (
    <span className="leading-tight inline-block">
      <span className="font-bold text-blue-700 text-lg tracking-tight block">
        F<span className="brick-text">i</span><span className="relative inline-block">
          <svg className="absolute left-0 -top-[0.22em] w-full h-[0.17em]" viewBox="0 0 24 4" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,3 L12,0 L24,3" fill="none" stroke="#44403c" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="brick-text">mm</span>
        </span>ax.AI
      </span>
      <span className="text-[11px] text-gray-400 block -mt-0.5">KI-gestützt. Maximal effizient.</span>
    </span>
  )
}
