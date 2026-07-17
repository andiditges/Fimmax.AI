export function Logo() {
  return (
    <span className="leading-tight inline-block">
      <span className="font-bold text-blue-700 text-lg tracking-tight block">
        F<span className="brick-text">i</span><span className="brick-text relative inline-block align-baseline">
          <svg className="absolute -left-[0.45em] -right-[0.45em] -top-[0.15em] w-auto h-[0.2em]" viewBox="0 0 24 4" preserveAspectRatio="none" shapeRendering="geometricPrecision" aria-hidden="true">
            <path d="M0,4 L12,0 L24,4" fill="none" stroke="#6b7280" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          mm
        </span>ax.AI
      </span>
      <span className="text-[11px] text-gray-400 block -mt-0.5">KI-gestützt. Maximal effizient.</span>
    </span>
  )
}
