import type { Metadata } from "next";
import { AuthPage } from "../auth-page";

export const metadata: Metadata = { title: "Masuk" };
export const dynamic = "force-dynamic";

export default function Page({ searchParams }: PageProps<"/masuk">) {
  return <AuthPage mode="masuk" searchParams={searchParams} />;
}
