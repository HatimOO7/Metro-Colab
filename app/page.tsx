import { AppShell } from "@/components/app-shell";
import { Suspense } from "react";

export default function Home() {
  return <Suspense><AppShell /></Suspense>;
}
