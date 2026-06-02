import { AuthGuard } from "@/components/auth/AuthGuard";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LessonList } from "@/components/lesson/LessonList";

export default function LessonsPage() {
  return (
    <AuthGuard allowedRoles={["student", "teacher", "admin"]}>
      <main className="min-h-screen bg-slate-100 p-8 text-slate-950">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Student
              </p>
              <h1 className="mt-3 text-3xl font-semibold">Danh sach bai hoc</h1>
            </div>
            <LogoutButton />
          </div>
          <div className="mt-8">
            <LessonList />
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
