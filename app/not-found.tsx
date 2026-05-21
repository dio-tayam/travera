import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: "var(--color-background)" }}>
      <svg width="80" height="80" viewBox="0 0 100 100" aria-hidden="true" className="mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1="50" y1="50"
            x2={50 + 40 * Math.cos(((i * 45 - 90) * Math.PI) / 180)}
            y2={50 + 40 * Math.sin(((i * 45 - 90) * Math.PI) / 180)}
            stroke="#FCD116" strokeWidth="5" strokeLinecap="round" />
        ))}
        <circle cx="50" cy="50" r="14" fill="#FCD116" />
      </svg>
      <h1
        className="text-4xl font-extrabold mb-2"
        style={{ color: "var(--color-primary)", fontFamily: "var(--font-heading)" }}
      >
        404
      </h1>
      <p
        className="text-base text-gray-500 mb-6"
        style={{ fontFamily: "var(--font-body)" }}
      >
        This page doesn&apos;t exist or you don&apos;t have access.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90"
        style={{ backgroundColor: "var(--color-primary)", fontFamily: "var(--font-body)" }}
      >
        Go Home
      </Link>
    </div>
  );
}
