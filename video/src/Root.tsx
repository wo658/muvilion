import { ContinuousReveal } from "./ContinuousReveal";
import { DesignerFilm } from "./DesignerFilm";
import { InputReveal } from "./InputReveal";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { Showroom } from "./Showroom";
export const RemotionRoot = () => (
  <>
    <Composition
      id="Muvilion-Continuous-15"
      component={ContinuousReveal}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Muvilion-Designer-Film"
      component={DesignerFilm}
      durationInFrames={1800}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Muvilion-Input-Reveal"
      component={InputReveal}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
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
