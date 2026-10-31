import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  Easing,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { TOKENS as T } from "../../web/lib/ui/tokens";
const ease = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.bezier(0.16, 0.9, 0.22, 1),
} as const;
const tween = (f: number, a: number, b: number, x: number, y: number) =>
  interpolate(f, [a, b], [x, y], ease);
const media = (name: string) => staticFile("designer-film/" + name);
function Mark({ dark = false }: { dark?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 92,
        top: 38,
        fontSize: 25,
        letterSpacing: -1,
        fontWeight: 750,
        color: dark ? T.accentInk : T.ink,
      }}
    >
      muvilion<span style={{ color: T.accent }}>.</span>
    </div>
  );
}
function Line({
  text,
  detail,
  dark = false,
}: {
  text: string;
  detail?: string;
  dark?: boolean;
}) {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 42,
        left: 120,
        right: 120,
        textAlign: "center",
        color: dark ? T.accentInk : T.ink,
        transform: `translateY(${tween(f, 0, 18, 22, 0)}px)`,
        opacity: tween(f, 0, 15, 0, 1),
      }}
    >
      <div style={{ fontSize: 38, fontWeight: 550, letterSpacing: -1 }}>
        {text}
      </div>
      {detail && (
        <div
          style={{
            fontSize: 20,
            marginTop: 10,
            color: dark ? T.hairline : T.muted,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
function Title({ words, kicker }: { words: string[]; kicker: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 23,
            letterSpacing: 5,
            color: T.muted,
            marginBottom: 35,
            opacity: tween(f, 0, 18, 0, 1),
          }}
        >
          {kicker}
        </div>
        {words.map((word, i) => {
          const p = spring({
            frame: f - i * 13,
            fps,
            config: { damping: 24, stiffness: 135 },
          });
          return (
            <div
              key={word}
              style={{
                fontSize: 136,
                fontWeight: 680,
                lineHeight: 1.04,
                letterSpacing: -7,
                transform: `translateY(${(1 - p) * 100}px) scale(${0.94 + 0.06 * p})`,
                opacity: p,
                color: i === words.length - 1 ? T.accent : T.ink,
              }}
            >
              {word}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
function Inputs() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const merge = tween(f, 220, 260, 0, 1);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 128,
          width: "100%",
          textAlign: "center",
          fontSize: 76,
          fontWeight: 650,
          letterSpacing: -3,
          opacity: tween(f, 215, 250, 1, 0),
        }}
      >
        Bring your context.
      </div>
      {["The floor plan.", "The brief.", "The brand."].map((title, i) => {
        const p = spring({
          frame: f - i * 13,
          fps,
          config: { damping: 21, stiffness: 140 },
        });
        return (
          <div
            key={title}
            style={{
              position: "absolute",
              left: 750,
              top: 310,
              width: 420,
              height: 500,
              background: T.surface,
              border: `1px solid ${T.hairline}`,
              borderRadius: 28,
              boxShadow: `0 30px 70px ${T.shadowColor}`,
              overflow: "hidden",
              transform: `translate(${(i - 1) * 490 * (1 - merge)}px,${(1 - p) * 240 - Math.sin(merge * Math.PI) * 140}px) rotate(${[-7, 0, 7][i] * (1 - merge) + merge * 35}deg) scale(${p * (1 - merge * 0.9)})`,
              opacity: tween(f, 248, 268, 1, 0),
            }}
          >
            <div
              style={{
                padding: 28,
                fontSize: 20,
                color: T.muted,
                letterSpacing: 2,
              }}
            >
              0{i + 1} / {["PDF", "PROJECT BRIEF", "BRAND URL"][i]}
            </div>
            {i === 0 ? (
              <Img
                src={staticFile("input-reveal/full-plan.png")}
                style={{ height: 280, width: "100%", objectFit: "contain" }}
              />
            ) : i === 1 ? (
              <div style={{ padding: "22px 32px", height: 236 }}>
                <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>
                  COMMUNITY
                  <br />
                  STUDIO
                </div>
                <div
                  style={{
                    height: 4,
                    width: 60,
                    background: T.accent,
                    margin: "24px 0",
                  }}
                />
                <div
                  style={{ fontSize: 23, color: T.inkSoft, lineHeight: 1.5 }}
                >
                  Stories. Experiences.
                  <br />A place to connect.
                </div>
              </div>
            ) : (
              <div style={{ padding: "40px 32px", height: 200 }}>
                <div
                  style={{
                    fontSize: 57,
                    fontWeight: 700,
                    color: T.accent,
                    letterSpacing: -3,
                  }}
                >
                  facebook
                </div>
                <div
                  style={{
                    marginTop: 24,
                    fontSize: 20,
                    padding: 15,
                    background: T.sunken,
                    borderRadius: 15,
                  }}
                >
                  ↗ meta.com/facebook-app
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 30 }}>
                  {[T.accent, T.bg, T.ink].map((c) => (
                    <div
                      key={c}
                      style={{
                        background: c,
                        width: 42,
                        height: 42,
                        borderRadius: 25,
                        border: `1px solid ${T.hairline}`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div style={{ padding: 28, fontSize: 32, fontWeight: 650 }}>
              {title}
            </div>
          </div>
        );
      })}
      <Line
        text="A real venue. A clear intent. Your brand."
        detail="Brand references use the URL and supplied notes."
      />
    </AbsoluteFill>
  );
}
type ScreenProps = {
  file: string;
  title: string;
  caption: string;
  detail?: string;
  video?: boolean;
  rate?: number;
  start?: number;
  zoom?: number;
  focus?: string;
  dark?: boolean;
};
function Screen({
  file,
  title,
  caption,
  detail,
  video = false,
  rate = 1,
  start = 0,
  zoom = 1,
  focus = "center",
  dark = false,
}: ScreenProps) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: dark ? T.ink : T.bg }}>
      <Mark dark={dark} />
      <div
        style={{
          position: "absolute",
          top: 36,
          right: 92,
          fontSize: 20,
          color: dark ? T.hairline : T.muted,
          letterSpacing: 2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 110,
          width: 1620,
          height: 820,
          borderRadius: 23,
          overflow: "hidden",
          background: T.surface,
          boxShadow: `0 25px 80px ${T.shadowColor}`,
          opacity: tween(f, 0, 12, 0, 1),
          transform: `translateY(${tween(f, 0, 22, 40, 0)}px) scale(${tween(f, 0, 65, 0.96, 1)})`,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${tween(f, 0, 220, zoom, zoom + 0.045)})`,
            transformOrigin: focus,
          }}
        >
          {video ? (
            <Video
              src={media(file)}
              trimBefore={start}
              playbackRate={rate}
              muted
              objectFit="contain"
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <Img
              src={media(file)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}
        </div>
      </div>
      <Line text={caption} detail={detail} dark={dark} />
    </AbsoluteFill>
  );
}
function Photo({
  file,
  title,
  subtitle,
}: {
  file: string;
  title: string;
  subtitle: string;
}) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: T.ink, color: T.accentInk }}>
      <Mark dark />
      <div
        style={{
          position: "absolute",
          top: 100,
          width: "100%",
          textAlign: "center",
          fontSize: 64,
          fontWeight: 600,
          letterSpacing: -2,
          opacity: tween(f, 0, 18, 0, 1),
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: 210,
          top: 220,
          width: 1500,
          height: 720,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: `0 25px 90px ${T.shadowColor}`,
          transform: `perspective(1500px) rotateY(${tween(f, 0, 40, -9, 0)}deg) scale(${tween(f, 0, 240, 0.91, 1.025)})`,
        }}
      >
        <Img
          src={media(file)}
          style={{ width: "100%", height: "100%", objectFit: "contain", transform: "scale(1.65)" }}
        />
      </div>
      <Line text={subtitle} dark />
    </AbsoluteFill>
  );
}
function Intelligence() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Mark />
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 160,
          fontSize: 85,
          fontWeight: 650,
          letterSpacing: -4,
        }}
      >
        AI that understands
        <br />
        <span style={{ color: T.accent }}>the whole space.</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          top: 480,
          display: "flex",
          gap: 28,
        }}
      >
        {[
          ["Understand", "PDF + brief + brand"],
          ["Compose", "Editable objects + review"],
          ["Frame", "Render, compare, select"],
        ].map(([a, b], i) => (
          <div
            key={a}
            style={{
              flex: 1,
              padding: "42px 35px",
              background: T.surface,
              borderRadius: 24,
              border: `1px solid ${T.hairline}`,
              opacity: tween(f, i * 24, i * 24 + 20, 0, 1),
              transform: `translateY(${tween(f, i * 24, i * 24 + 28, 80, 0)}px)`,
            }}
          >
            <div style={{ fontSize: 22, color: T.accent, marginBottom: 28 }}>
              0{i + 1}
            </div>
            <div style={{ fontSize: 42, fontWeight: 650 }}>{a}</div>
            <div style={{ fontSize: 24, color: T.muted, marginTop: 18 }}>
              {b}
            </div>
          </div>
        ))}
      </div>
      <Line
        text="Powered by Meta AI. Grounded in the actual 3D scene."
        detail="Geometry extraction and checks run in the engine. Designers review the result."
      />
    </AbsoluteFill>
  );
}
export const DesignerFilm = () => (
  <AbsoluteFill
    style={{
      background: T.bg,
      color: T.ink,
      fontFamily: '"SF Pro Display","Apple SD Gothic Neo",sans-serif',
    }}
  >
    <Sequence durationInFrames={180} name="01 · An idea becomes a space">
      <Title
        kicker="FOR SPATIAL DESIGNERS"
        words={["From an idea.", "To a space."]}
      />
    </Sequence>
    <Sequence
      from={180}
      durationInFrames={270}
      name="02 · Three sources converge"
    >
      <Inputs />
    </Sequence>
    <Sequence from={450} durationInFrames={240} name="03 · Product promise">
      <Screen
        file="overview.mp4"
        video
        title="DESIGN → REFINE → PHOTOGRAPH"
        caption="One workspace. From brief to concept shot."
      />
    </Sequence>
    <Sequence
      from={690}
      durationInFrames={240}
      name="04 · Actual source library"
    >
      <Screen
        file="sources.jpg"
        title="01 / CONTEXT"
        caption="Keep the drawing, brief and brand together."
      />
    </Sequence>
    <Sequence
      from={930}
      durationInFrames={210}
      name="05 · Actual project brief"
    >
      <Screen
        file="brief.jpg"
        title="01 / CONTEXT"
        caption="Tell Muse what the space needs to do."
        detail="A welcome desk, story panels, demos, a lounge and a stage."
        zoom={1.12}
      />
    </Sequence>
    <Sequence
      from={1140}
      durationInFrames={210}
      name="06 · Actual brand reference"
    >
      <Screen
        file="brand.jpg"
        title="01 / CONTEXT"
        caption="Give the design a point of view."
        detail="Official brand URL + supplied reference notes. No automatic web crawl."
        zoom={1.08}
      />
    </Sequence>
    <Sequence
      from={1350}
      durationInFrames={150}
      name="07 · Actual design request"
    >
      <Screen
        file="design-request.jpg"
        title="02 / CREATE"
        caption="Describe the space you have in mind."
      />
    </Sequence>
    <Sequence
      from={1500}
      durationInFrames={360}
      name="08 · Live generation first pass"
    >
      <Screen
        file="generation-01.mp4"
        video
        rate={1.95}
        title="02 / CREATE"
        caption="Watch the design take shape."
        detail="Actual app recording · waiting time shortened"
      />
    </Sequence>
    <Sequence
      from={1860}
      durationInFrames={360}
      name="09 · Live furniture placement"
    >
      <Screen
        file="generation-02.mp4"
        video
        rate={2}
        title="02 / CREATE"
        caption="Real furniture. Editable placements."
        detail="Actual app recording · waiting time shortened"
      />
    </Sequence>
    <Sequence from={2220} durationInFrames={120} name="10 · Review proposal">
      <Screen
        file="proposal.jpg"
        title="02 / REVIEW"
        caption="Review the proposal before applying it."
      />
    </Sequence>
    <Sequence from={2340} durationInFrames={120} name="11 · Applied design">
      <Screen
        file="applied.mp4"
        video
        title="02 / APPLY"
        caption="Your design stays yours to edit."
      />
    </Sequence>
    <Sequence
      from={2460}
      durationInFrames={300}
      name="12 · Explore the designed space"
    >
      <Screen
        file="overview.mp4"
        video
        title="03 / EXPLORE"
        caption="See how the space comes together."
      />
    </Sequence>
    <Sequence
      from={2760}
      durationInFrames={210}
      name="13 · Real conversational revision"
    >
      <Screen
        file="revision-request.jpg"
        title="03 / REFINE"
        caption="A small request. A precise change."
        detail="“Brighten the stage. Turn the lounge chairs toward the table.”"
      />
    </Sequence>
    <Sequence
      from={2970}
      durationInFrames={270}
      name="14 · Actual revision result"
    >
      <Screen
        file="revision.mp4"
        video
        title="03 / REFINE"
        caption="Refine the color. Improve the seating."
      />
    </Sequence>
    <Sequence
      from={3240}
      durationInFrames={240}
      name="15 · Ask for a concept shot"
    >
      <Screen
        file="photo-request.jpg"
        title="04 / PHOTOGRAPH"
        caption="Now, find the shot that tells the story."
      />
    </Sequence>
    <Sequence
      from={3480}
      durationInFrames={270}
      name="16 · Real camera candidate review"
    >
      <Screen
        file="photo-process.mp4"
        video
        title="04 / PHOTOGRAPH"
        caption="Muse frames, renders and compares camera angles."
        detail="Actual scene captures · camera review"
      />
    </Sequence>
    <Sequence
      from={3750}
      durationInFrames={300}
      name="17 · Actual selected camera shot"
    >
      <Screen
        file="photo-ui.jpg"
        title="04 / PHOTOGRAPH"
        caption="A concept shot from the space you designed."
      />
    </Sequence>
    <Sequence from={4050} durationInFrames={300} name="18 · Hero concept shot">
      <Photo
        file="concept-01.jpg"
        title="Your design. Through a new lens."
        subtitle="Captured from the actual 3D scene."
      />
    </Sequence>
    <Sequence
      from={4350}
      durationInFrames={150}
      name="19 · Actual camera fine tuning"
    >
      <Screen
        file="retake.mp4"
        video
        title="04 / FINE-TUNE"
        caption="Adjust the angle. Make it yours."
      />
    </Sequence>
    <Sequence
      from={4500}
      durationInFrames={300}
      name="20 · Final concept photo"
    >
      <Photo
        file="concept-02.jpg"
        title="Ready to share."
        subtitle="Download the concept shot and keep designing."
      />
    </Sequence>
    <Sequence from={4800} durationInFrames={300} name="21 · Meta AI workflow">
      <Intelligence />
    </Sequence>
    <Sequence
      from={5100}
      durationInFrames={180}
      name="22 · Exhibitor extension"
    >
      <Screen
        file="participant.jpg"
        title="ALSO FOR EXHIBITORS"
        caption="A workspace for exhibitors, too."
        detail="Separate demo booth · participant workflow preview"
      />
    </Sequence>
    <Sequence from={5280} durationInFrames={120} name="23 · Closing">
      <Title kicker="FROM CONTEXT TO CONCEPT" words={["muvilion."]} />
    </Sequence>
    <Audio src={media("music.m4a")} volume={0.6} />
  </AbsoluteFill>
);
