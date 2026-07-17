export function Logo() {
  return (
    <span className="leading-tight inline-block">
      <span className="font-bold text-blue-700 text-lg tracking-tight block">
        F<span className="brick-text">i</span><span className="brick-text relative inline-block align-baseline">
          <svg className="absolute left-0 -top-[0.28em] w-full h-[0.08em]" viewBox="0 0 24 6" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,6 L12,0 L24,6" fill="none" stroke="#8f3a1a" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" shapeRendering="geometricPrecision" />
          </svg>
          mm
        </span>ax.AI
      </span>
      <span className="text-[11px] text-gray-400 block -mt-0.5">KI-gestützt. Maximal effizient.</span>
    </span>
  )
}
