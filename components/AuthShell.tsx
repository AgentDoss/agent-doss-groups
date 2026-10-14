"use client";
import Logo from "@/components/Logo";
import "./auth-v7.css";

/** Décor "Login V7" partagé : fond rubans noir/or + carte vitrée. N'affecte que les pages d'authentification. */
export function Ic({ d, className = "ic" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
export const ICONS = {
  mail: "M4 6h16v12H4z M4 7l8 6 8-6",
  lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18 M10.6 6.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9 M6.5 6.6A17 17 0 0 0 2 12s4 7 10 7a9.7 9.7 0 0 0 4-.9 M9.9 9.9a3 3 0 0 0 4.2 4.2",
  arrow: "M5 12h14 M13 6l6 6-6 6",
};

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="v7Wrap">
      <div className="v7Bg" aria-hidden="true">
        <svg viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="v7g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6b4a10" stopOpacity="0" /><stop offset=".5" stopColor="#f6d52f" /><stop offset="1" stopColor="#a56a10" stopOpacity="0" /></linearGradient>
            <linearGradient id="v7g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a2a2e" /><stop offset="1" stopColor="#050506" /></linearGradient>
          </defs>
          <path d="M-100 120 C 250 60 500 420 1300 260 L1300 520 C 600 640 350 250 -100 380Z" fill="url(#v7g2)" opacity=".9" />
          <path d="M-100 520 C 300 420 700 900 1300 640 L1300 900 L-100 900Z" fill="url(#v7g2)" />
          <path d="M-100 150 C 260 100 520 450 1300 290" stroke="url(#v7g1)" strokeWidth="3" fill="none" />
          <path d="M-100 210 C 280 150 540 480 1300 360" stroke="url(#v7g1)" strokeWidth="1.5" fill="none" opacity=".7" />
          <path d="M700 -50 C 800 250 1000 300 1300 330" stroke="url(#v7g1)" strokeWidth="2.5" fill="none" />
          <path d="M-100 700 C 300 560 800 980 1300 700" stroke="url(#v7g1)" strokeWidth="2" fill="none" opacity=".6" />
          <path d="M900 520 C 1000 560 1150 540 1300 480 L1300 620 C 1150 700 1000 680 900 640Z" fill="#c8901a" opacity=".35" />
        </svg>
        <div className="vig" />
      </div>
      {children}
    </main>
  );
}

export function Brand({ title, sub }: { title: React.ReactNode; sub?: string }) {
  return (
    <>
      <div className="v7Head">
        <Logo size={44} />
        <span className="v7Brand">AGENT DOSS GROUPS</span>
      </div>
      <h1 className="v7Title">{title}</h1>
      {sub && <p className="v7Sub">{sub}</p>}
    </>
  );
}
