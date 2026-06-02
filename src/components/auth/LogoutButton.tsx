"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { logout } from "@/lib/auth";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      title="Dang xuat"
      aria-label="Dang xuat"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-700 transition hover:bg-white hover:text-emerald-700"
    >
      <LogOut size={18} />
    </button>
  );
}
