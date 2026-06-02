import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Streamline English
          </p>
          <h1 className="text-5xl font-semibold leading-tight text-white sm:text-6xl">
            Nền tảng học tiếng Anh cho học viên, giáo viên và phụ huynh.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Học theo bài, nghe audio, làm quiz, nộp bài, theo dõi tiến độ và
            quản lý lớp học trong một hệ thống thống nhất.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-md bg-emerald-400 px-6 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Tạo tài khoản
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
