import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-lg bg-white shadow-xl md:grid-cols-[0.95fr_1.05fr]">
          <section className="bg-slate-950 p-8 text-white sm:p-10">
            <Link href="/" className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Streamline English
            </Link>
            <div className="mt-20 max-w-md">
              <h1 className="text-4xl font-semibold leading-tight">{title}</h1>
              <p className="mt-5 text-base leading-7 text-slate-300">{description}</p>
            </div>
          </section>
          <section className="p-8 sm:p-10">
            <div className="mx-auto max-w-md">{children}</div>
          </section>
        </div>
      </div>
    </main>
  );
}
