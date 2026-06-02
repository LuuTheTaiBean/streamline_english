import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { AppUser } from "@/types/user";

export async function registerStudent(params: {
  fullname: string;
  email: string;
  password: string;
}) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    params.email,
    params.password,
  );

  const userData = {
    fullname: params.fullname,
    email: params.email,
    role: "student",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", credential.user.uid), userData);

  return credential.user;
}

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", credential.user.uid));

  if (!userDoc.exists()) {
    throw new Error("Tài khoản chưa có hồ sơ người dùng.");
  }

  return {
    authUser: credential.user,
    profile: {
      id: userDoc.id,
      ...userDoc.data(),
    } as AppUser,
  };
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export function logout() {
  return signOut(auth);
}
