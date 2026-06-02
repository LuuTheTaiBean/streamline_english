import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthShell } from "@/components/auth/AuthShell";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Tạo tài khoản học viên"
      description="Tài khoản mới sẽ được lưu vào Firebase Auth và Firestore với vai trò học viên mặc định."
    >
      <RegisterForm />
    </AuthShell>
  );
}
