"use client";

import { useEffect } from "react";
import { requireSession } from "@/lib/auth/session";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";

export default function DashboardHome() {
  useEffect(() => {
    (async () => {
      const session = await requireSession();
      if (!session) {
        window.location.href = "/login";
        return;
      }

      await bootstrapOrg();
      window.location.href = "/dashboard/products";
    })();
  }, []);

  return <div className="p-6">Loading dashboard…</div>;
}
