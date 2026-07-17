export function BrickLoader({ className = '' }: { className?: string }) {
  const delays = [0, 80, 160, 240, 320, 400]
  return (
    <div className={`inline-flex flex-col-reverse gap-[2px] ${className}`} role="status" aria-label="Lädt">
      <div className="flex gap-[2px]">
        <span className="brick-loader-brick" style={{ animationDelay: `${delays[0]}ms` }} />
        <span className="brick-loader-brick" style={{ animationDelay: `${delays[1]}ms` }} />
      </div>
      <div className="flex gap-[2px] ml-[8px]">
        <span className="brick-loader-brick" style={{ animationDelay: `${delays[2]}ms` }} />
        <span className="brick-loader-brick" style={{ animationDelay: `${delays[3]}ms` }} />
      </div>
      <div className="flex gap-[2px]">
        <span className="brick-loader-brick" style={{ animationDelay: `${delays[4]}ms` }} />
        <span className="brick-loader-brick" style={{ animationDelay: `${delays[5]}ms` }} />
      </div>
    </div>
  )
}
