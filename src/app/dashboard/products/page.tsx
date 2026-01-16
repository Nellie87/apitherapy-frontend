"use client";

import { useEffect, useState } from "react";
import { requireOrg } from "@/lib/guard/requireOrg";
import { listProducts, createProduct, deleteProduct } from "@/lib/api/products";

export default function ProductsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");

  async function refresh(o: string) {
    setItems(await listProducts(o));
  }

  useEffect(() => {
    (async () => {
      const o = await requireOrg();
      if (!o) return;
      setOrgId(o);
      await refresh(o);
    })();
  }, []);

  if (!orgId) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-black">Products</div>
        <a className="text-sm underline" href="/dashboard/org">Switch Org</a>
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="border rounded-xl px-3 py-2 w-[320px]" placeholder="Product name"
          value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded-xl px-3 py-2 w-[160px]" placeholder="Unit price"
          value={price} onChange={(e) => setPrice(e.target.value)} />
        <button
          className="bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold"
          onClick={async () => {
            if (!name.trim()) return;
            await createProduct(orgId, { name: name.trim(), unit_price: Number(price || 0) });
            setName(""); setPrice("0");
            await refresh(orgId);
          }}
        >
          Add Product
        </button>
      </div>

      <div className="border rounded-2xl overflow-hidden bg-white">
        <table className="w-full">
          <thead className="bg-zinc-50 text-left text-xs">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Price</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.name}</td>
                <td className="p-3">${Number(p.unit_price).toFixed(2)}</td>
                <td className="p-3">
                  <button className="text-rose-600 font-semibold"
                    onClick={async () => { await deleteProduct(orgId, p.id); await refresh(orgId); }}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr><td className="p-3 text-sm text-zinc-500" colSpan={3}>No products yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
