import sample from "@/fixtures/sample_hall.json";
import { ReviewConsole } from "@/components/review-console";
import { ProjectInput } from "@/lib/engine/contract";

// Default project input: the sample hall fixture (mirrors fixtures/sample_hall.json at the repo root).
const project = ProjectInput.parse(sample);

export default function Page() {
  return (
    <main className="flex-1">
      <ReviewConsole project={project} />
    </main>
  );
}
