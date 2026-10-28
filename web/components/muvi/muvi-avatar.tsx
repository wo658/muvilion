import Image from "next/image";

/** One brand asset for navigation, chat, messages and launchers. Decorative by default. */
export function MuviAvatar({ size = 32, alt = "" }: { size?: number; alt?: string }) {
  return <Image src="/mascot/muvi-face.svg" alt={alt} width={size} height={size} className="shrink-0"/>;
}
