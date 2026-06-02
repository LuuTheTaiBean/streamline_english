import { AuthGuard } from "@/components/auth/AuthGuard";
import { LessonPlayer } from "@/components/lesson/LessonPlayer";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;

  return (
    <AuthGuard allowedRoles={["student", "teacher", "admin"]}>
      <main className="h-dvh overflow-hidden bg-slate-100 p-4 text-slate-950">
        <div className="mx-auto flex h-full max-w-7xl flex-col">
          <LessonPlayer lessonId={lessonId} />
        </div>
      </main>
    </AuthGuard>
  );
}
