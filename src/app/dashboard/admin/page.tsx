import { AuthGuard } from "@/components/auth/AuthGuard";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function AdminDashboardPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Admin
              </p>
              <h1 className="mt-3 text-3xl font-semibold">Admin Dashboard</h1>
            </div>
            <LogoutButton />
          </div>
          <p className="mt-4 text-slate-600">
            Buoc sau se them quan ly user, bai hoc, quiz va thanh toan.
          </p>
        </div>
      </main>
    </AuthGuard>
  );
}
