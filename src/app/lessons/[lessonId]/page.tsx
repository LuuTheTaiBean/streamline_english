import {AuthGuard} from "@/components/auth/AuthGuard";
import {LessonPlayer} from "@/components/lesson/LessonPlayer";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{lessonId: string}>;
}) {
  const {lessonId} = await params;

  return (
    <AuthGuard allowedRoles={["student", "teacher", "admin"]}>
      <main className="flex min-h-dvh flex-col bg-slate-100 p-4 text-slate-950 xl:h-dvh xl:overflow-hidden">
        <div className="mx-auto flex flex-1 max-w-7xl flex-col xl:h-full">
          <LessonPlayer lessonId={lessonId} />
        </div>
      </main>
    </AuthGuard>
  );
}
