import { redirect } from "next/navigation";

/** Legacy setup links lead to the real workspace checklist. */
export default function Page() {
  redirect("/app");
}
