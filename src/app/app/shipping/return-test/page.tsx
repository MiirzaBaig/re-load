import { notFound } from "next/navigation";
import { ReturnTest } from "@/views/shipping-return-test";
export default function Page() {
  if (process.env.OTO_SANDBOX_RETURNS_ENABLED !== "true") notFound();
  return <ReturnTest />;
}
