import sample from "@/fixtures/sample_hall.json";
import { ProjectInput } from "@/lib/engine/contract";

export const project = () => ProjectInput.parse(structuredClone(sample));
