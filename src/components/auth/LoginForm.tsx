"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { loginWithEmail, resetPassword } from "@/lib/auth";
import type { UserRole } from "@/types/user";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(1, "Nhập mật khẩu."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const roleRoutes: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  teacher: "/dashboard/teacher",
  student: "/lessons",
  parent: "/dashboard/parent",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formMessage, setFormMessage] = useState(
    searchParams.get("registered") ? "Tạo tài khoản thành công. Bạn có thể đăng nhập." : "",
  );
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    setFormError("");
    setFormMessage("");

    try {
      const { profile } = await loginWithEmail(values.email.trim(), values.password);
      router.push(roleRoutes[profile.role] ?? "/lessons");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể đăng nhập.");
    }
  }

  async function handleResetPassword() {
    const email = getValues("email")?.trim();

    if (!email) {
      setFormError("Nhập email trước khi lấy lại mật khẩu.");
      return;
    }

    try {
      await resetPassword(email);
      setFormError("");
      setFormMessage("Đã gửi email đặt lại mật khẩu.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể gửi email đặt lại mật khẩu.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          {...register("email")}
        />
        {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email.message}</p> : null}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          className="h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          {...register("password")}
        />
        {errors.password ? <p className="mt-1 text-sm text-red-600">{errors.password.message}</p> : null}
      </div>

      <button
        type="button"
        onClick={handleResetPassword}
        className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
      >
        Quên mật khẩu?
      </button>

      {formMessage ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{formMessage}</p> : null}
      {formError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="font-semibold text-emerald-700 hover:text-emerald-800">
          Đăng ký
        </Link>
      </p>
    </form>
  );
}
