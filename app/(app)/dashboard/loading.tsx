export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10" aria-busy="true" aria-label="Loading trips">
      <div className="skeleton h-3 w-40" />
      <div className="skeleton mt-4 h-10 w-72" />
      <div className="skeleton mt-8 h-[92px] w-full rounded-[var(--radius-panel)]" />
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map(i => <div key={i} className="skeleton h-[230px] rounded-[var(--radius-panel)]" />)}
      </div>
    </div>
  );
}
