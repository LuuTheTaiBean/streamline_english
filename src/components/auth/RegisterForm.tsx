"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { registerStudent } from "@/lib/auth";

const registerSchema = z
  .object({
    fullname: z.string().min(2, "Nhập họ và tên."),
    email: z.string().email("Email không hợp lệ."),
    password: z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự."),
    confirmPassword: z.string().min(6, "Nhập lại mật khẩu."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu nhập lại không khớp.",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterFormValues) {
    setFormError("");

    try {
      await registerStudent({
        fullname: values.fullname.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      router.push("/login?registered=1");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể đăng ký tài khoản.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="fullname">
          Họ và tên
        </label>
        <input
          id="fullname"
          className="h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          {...register("fullname")}
        />
        {errors.fullname ? <p className="mt-1 text-sm text-red-600">{errors.fullname.message}</p> : null}
      </div>

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

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
          Xác nhận mật khẩu
        </label>
        <input
          id="confirmPassword"
          type="password"
          className="h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
        ) : null}
      </div>

      {formError ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-md bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isSubmitting ? "Đang tạo tài khoản..." : "Đăng ký"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
