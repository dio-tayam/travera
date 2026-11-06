import type { Metadata } from "next";
import { SuspendedNotice } from "./suspended-notice";

export const metadata: Metadata = { title: "Account suspended", robots: { index: false } };

export default function SuspendedPage() {
  return <SuspendedNotice />;
}
