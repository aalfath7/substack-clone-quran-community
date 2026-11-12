import type { Metadata } from "next";
import { AuthPage } from "../auth-page";

export const metadata: Metadata = { title: "Daftar" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: PageProps<"/daftar">) {
  return <AuthPage mode="daftar" searchParams={searchParams} />;
}
