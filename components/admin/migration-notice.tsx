export function MigrationNotice({ message }: { message?: string }) {
  return (
    <div className="panel mt-6 px-5 py-5">
      <p className="text-[14px] font-medium text-ink">Admin data isn&apos;t available.</p>
      <p className="mt-1 text-[13px] text-ink-2">
        Run <code className="rounded bg-sunken px-1 font-mono text-[12px]">supabase/v2-roles-privacy-admin.sql</code> in the Supabase SQL editor.
      </p>
      {message && <p className="mt-2 font-mono text-[11.5px] text-negative">{message}</p>}
    </div>
  );
}
