"use client";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { auth, db } from "@/lib/firebase";
import type { AppUser, UserRole } from "@/types/user";

const roleRoutes: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  teacher: "/dashboard/teacher",
  student: "/lessons",
  parent: "/dashboard/parent",
};

export function AuthGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists()) {
        setStatus("denied");
        return;
      }

      const profile = {
        id: userSnap.id,
        ...userSnap.data(),
      } as AppUser;

      if (!allowedRoles.includes(profile.role)) {
        router.replace(roleRoutes[profile.role] ?? "/login");
        return;
      }

      setStatus("allowed");
    });

    return unsubscribe;
  }, [allowedRoles, router]);

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <p className="text-sm font-medium">Dang kiem tra tai khoan...</p>
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <p className="text-sm font-medium">Tai khoan chua co ho so nguoi dung.</p>
      </main>
    );
  }

  return children;
}
