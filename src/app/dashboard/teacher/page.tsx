import { AuthGuard } from "@/components/auth/AuthGuard";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function TeacherDashboardPage() {
  return (
    <AuthGuard allowedRoles={["teacher", "admin"]}>
      <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Teacher
              </p>
              <h1 className="mt-3 text-3xl font-semibold">Teacher Dashboard</h1>
            </div>
            <LogoutButton />
          </div>
          <p className="mt-4 text-slate-600">
            Buoc sau se them danh sach bai nop, cham bai va export Word.
          </p>
        </div>
      </main>
    </AuthGuard>
  );
}
