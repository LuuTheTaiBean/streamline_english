import { Suspense } from "react";

import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell
      title="Đăng nhập hệ thống"
      description="Sau khi đăng nhập, hệ thống sẽ điều hướng theo vai trò của tài khoản."
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
