import { AuthGuard } from "@/components/auth/AuthGuard";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function ParentDashboardPage() {
  return (
    <AuthGuard allowedRoles={["parent", "admin"]}>
      <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Parent
              </p>
              <h1 className="mt-3 text-3xl font-semibold">Parent Dashboard</h1>
            </div>
            <LogoutButton />
          </div>
          <p className="mt-4 text-slate-600">
            Buoc sau se them theo doi diem quiz va tien do hoc cua con.
          </p>
        </div>
      </main>
    </AuthGuard>
  );
}
