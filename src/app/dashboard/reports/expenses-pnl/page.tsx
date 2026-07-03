"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ExpensesPnlRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/reports/revenue-health");
  }, [router]);
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500">
      Redirecting to Revenue Health…
    </div>
  );
}
