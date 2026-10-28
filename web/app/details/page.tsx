import { redirect } from "next/navigation";

/** Existing bookmarks now lead to the drawing studio. */
export default function DetailsPage() {
  redirect("/");
}
