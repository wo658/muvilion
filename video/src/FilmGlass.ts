import { TOKENS as T } from "../../web/lib/ui/tokens";
export const FILM_GLASS = {
  background: `linear-gradient(135deg, color-mix(in srgb, ${T.surface} 88%, transparent), color-mix(in srgb, ${T.accentSoft} 38%, transparent) 55%, color-mix(in srgb, ${T.surface} 72%, transparent))`,
  shadow: `inset 0 2px 2px ${T.surface}, inset 0 -2px 3px ${T.hairline}, 0 24px 70px ${T.shadowColor}`,
  radius: 56,
  button: {
    width: 78,
    height: 78,
    borderRadius: "50%",
    background: `linear-gradient(140deg,${T.museGlow},${T.accent})`,
    border: `2px solid ${T.accentSoft}`,
    boxShadow: `inset 0 3px 8px ${T.accentSoft}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: T.accentInk,
    fontSize: 54,
  } as const,
};
