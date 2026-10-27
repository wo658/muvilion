import type { Metadata } from "next";
import { ReviewConsole } from "@/components/review-console";

export const metadata: Metadata = { title: "Layout Engineer · Details" };

/** The expert review console on its own (the simple view also opens it in place, with the same run). */
export default function DetailsPage() {
  return (
    <main className="flex-1">
      <ReviewConsole />
    </main>
  );
}
