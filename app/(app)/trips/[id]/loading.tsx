export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton mt-4 h-10 w-80 max-w-full" />
      <div className="skeleton mt-8 h-[110px] w-full rounded-[var(--radius-panel)]" />
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="skeleton h-[280px] rounded-[var(--radius-panel)]" />
        <div className="skeleton h-[180px] rounded-[var(--radius-panel)]" />
      </div>
    </div>
  );
}
