"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [msg, setMsg] = useState<string>("");

  async function handleSubmit() {
    setMsg("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Signup successful. Check your email if confirmation is enabled.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/dashboard";
      }
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-zinc-100">
      <div className="w-[420px] bg-white border rounded-2xl p-6 shadow">
        <div className="text-2xl font-black">BeeShop</div>
        <div className="text-sm text-zinc-500 mt-1">
          {mode === "login" ? "Sign in to continue" : "Create an account"}
        </div>

        <div className="mt-5 space-y-3">
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border rounded-xl px-3 py-2"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {msg ? <div className="text-sm text-rose-600">{msg}</div> : null}

          <button
            className="w-full bg-amber-500 text-white rounded-xl py-2 font-semibold"
            onClick={handleSubmit}
          >
            {mode === "login" ? "Login" : "Sign Up"}
          </button>

          <button
            className="w-full text-sm text-zinc-700"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login"
              ? "No account? Sign up"
              : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
