import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { Showroom } from "./Showroom";
export const RemotionRoot = () => (
  <>
    <Composition
      id="Muvilion-Space"
      component={MyComposition}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Muvilion-Atelier"
      component={Showroom}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
