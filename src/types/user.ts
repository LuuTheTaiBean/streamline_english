export type UserRole = "admin" | "teacher" | "student" | "parent";

export type AppUser = {
  id: string;
  fullname: string;
  email: string;
  role: UserRole;
  childId?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
