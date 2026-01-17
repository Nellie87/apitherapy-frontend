"use client";

import { useEffect, useState } from "react";
import { bootstrapOrg } from "@/lib/org/bootstrapOrg";
import { listProducts, createProduct, deleteProduct } from "@/lib/api/products";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {children}
    </div>
  );
}

export default function ProductsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [err, setErr] = useState<string>("");


  async function refresh(o: string) {
    setItems(await listProducts(o));
  }

  useEffect(() => {
    (async () => {
      try {
        const o = await bootstrapOrg();
        setOrgId(o);
        await refresh(o);
      } catch (e: any) {
        setErr(e.message ?? String(e));
      }
    })();
  }, []);


  if (!orgId) return <div>Loading…</div>;

  return (
    <div className="space-y-5">

      {/* Error */}
      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {err}
        </div>
      )}
      
      {/* Top bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs text-zinc-500">Inventory / Products</div>
          <h1 className="mt-1 text-2xl font-black text-zinc-900">
            Product Catalog
          </h1>
        </div>

        <div className="flex gap-2">
          <input
            className="w-[260px] rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            placeholder="Search (MVP later)"
          />
          <button className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50">
            Filters
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="p-5">
            <div className="text-xs font-semibold text-zinc-500">Total Products</div>
            <div className="mt-1 text-3xl font-black">{items.length}</div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="text-xs font-semibold text-zinc-500">Low Stock</div>
            <div className="mt-1 text-3xl font-black">—</div>
            <div className="mt-1 text-xs text-zinc-500">
              (We’ll compute from inventory next)
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="text-xs font-semibold text-zinc-500">Catalog Value</div>
            <div className="mt-1 text-3xl font-black">—</div>
            <div className="mt-1 text-xs text-zinc-500">
              (We’ll add later)
            </div>
          </div>
        </Card>
      </div>

      {/* Create product */}
      <Card>
        <div className="p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black text-zinc-900">Add New Product</div>
            <div className="mt-1 text-xs text-zinc-500">Fast CRUD setup</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm w-[260px]"
              placeholder="Product name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm w-[160px]"
              placeholder="Unit price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <button
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
              onClick={async () => {
                if (!name.trim()) return;
                await createProduct(orgId, {
                  name: name.trim(),
                  unit_price: Number(price || 0),
                });
                setName("");
                setPrice("0");
                await refresh(orgId);
              }}
            >
              + Add Product
            </button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="p-5">
          <div className="text-sm font-black text-zinc-900">Products</div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200">
            <table className="w-full border-collapse">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-zinc-500 w-[120px]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-zinc-200">
                    <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">
                      ${Number(p.unit_price).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="text-sm font-semibold text-rose-600 hover:underline"
                        onClick={async () => {
                          await deleteProduct(orgId, p.id);
                          await refresh(orgId);
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-sm text-zinc-500" colSpan={3}>
                      No products yet. Add your first product above.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
