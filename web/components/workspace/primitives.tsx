import type { ReactNode, SVGProps } from "react";

const paths: Record<string, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="m9 5 7 7-7 7M3 12h13" />,
  back: <path d="m12 5-7 7 7 7M5 12h16" />,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
  file: <><path d="M14 3H5v18h14V8l-5-5Z" /><path d="M14 3v6h5M8 13h8M8 17h5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  cloud: <><path d="M7 18H6a4 4 0 1 1 1-8 6 6 0 0 1 12-1 4.5 4.5 0 0 1 0 9h-2" /><path d="M12 12v9m-3-6 3-3 3 3" /></>,
  ruler: <><path d="m3 17 14-14 4 4L7 21Z" /><path d="m7 13 2 2m2-6 2 2m2-6 2 2" /></>,
  box: <rect x="4" y="4" width="16" height="16" rx="1" />,
  door: <><path d="M5 21V3h14v18M2 21h20M15 12h1" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  download: <><path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
  play: <path d="m8 4 12 8-12 8Z" />,
};
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.grid}</svg>;
}
export function Brand() {
  return <span className="ws-brand"><span className="ws-brand-symbol"><Icon name="grid" /></span><span>Layout<span className="font-normal text-muted"> Engineer</span></span></span>;
}
export function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.7 2.9-4.3 2.9-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14.1a6 6 0 0 1 0-4.2V7.3H3a10 10 0 0 0 0 9.4l3.4-2.6Z"/><path fill="#EA4335" d="M12 5.8c1.5 0 2.9.5 3.9 1.5L18.8 4A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.3l3.4 2.6C7.2 7.6 9.4 5.8 12 5.8Z"/></svg>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="ws-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
