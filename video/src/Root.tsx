import { Composition } from "remotion";
import { MyComposition } from "./Composition";
export const RemotionRoot = () => (
  <Composition
    id="Muvilion-Space"
    component={MyComposition}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
  />
);
