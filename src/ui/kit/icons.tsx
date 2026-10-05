import React from 'react';

type IconProps = { size?: number; className?: string; strokeWidth?: number };

function Stroke({ size = 18, className, strokeWidth = 1.9, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export const CloseIcon = (p: IconProps) => <Stroke {...p}><path d="M6 6l12 12M18 6L6 18" /></Stroke>;
export const BackIcon = (p: IconProps) => <Stroke {...p}><path d="M15 5l-7 7 7 7" /></Stroke>;
export const ChevronRight = (p: IconProps) => <Stroke {...p}><path d="M9 6l6 6-6 6" /></Stroke>;
export const ChevronDown = (p: IconProps) => <Stroke {...p}><path d="M6 9l6 6 6-6" /></Stroke>;
export const HelpIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
    <path d="M12 17.2h.01" />
  </Stroke>
);
export const CopyIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.6" />
    <path d="M15.5 8.5V6.6A2.1 2.1 0 0 0 13.4 4.5H6.6A2.1 2.1 0 0 0 4.5 6.6v6.8a2.1 2.1 0 0 0 2.1 2.1h1.9" />
  </Stroke>
);
export const CheckIcon = (p: IconProps) => <Stroke {...p}><path d="M5 12.5l4.2 4.2L19 7" /></Stroke>;
export const RefreshIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4.2h-4.2" />
  </Stroke>
);
export const PuzzleIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 4.5a2 2 0 1 1 4 0V6h3a1.5 1.5 0 0 1 1.5 1.5v3H19a2 2 0 1 1 0 4h-1.5v3A1.5 1.5 0 0 1 16 19h-3v-1.5a2 2 0 1 0-4 0V19H6a1.5 1.5 0 0 1-1.5-1.5v-3H6a2 2 0 1 0 0-4H4.5v-3A1.5 1.5 0 0 1 6 6h3z" />
  </Stroke>
);
export const PhoneIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="6.5" y="2.8" width="11" height="18.4" rx="2.8" />
    <path d="M10.8 18h2.4" />
  </Stroke>
);
export const LockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.6" />
    <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
  </Stroke>
);
export const LogoutIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h7" />
    <path d="M17 8.5l3.5 3.5L17 15.5M20.5 12H10" />
  </Stroke>
);
export const SwitchIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M16.5 4l3.5 3.5-3.5 3.5M20 7.5H8" />
    <path d="M7.5 20L4 16.5 7.5 13M4 16.5h12" />
  </Stroke>
);
export const AlertIcon = (p: IconProps) => (
  <Stroke {...p} strokeWidth={2.4}>
    <path d="M12 7.5v5.5M12 16.6h.01" />
  </Stroke>
);
export const ShieldIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3.2l7 2.6v5.6c0 4.4-3 8-7 9.4-4-1.4-7-5-7-9.4V5.8z" />
    <path d="M9 12l2.1 2.1L15.2 10" />
  </Stroke>
);
export const BoltIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M7 7.5h10.5l-3-3M17 16.5H6.5l3 3" />
  </Stroke>
);
export const CompassIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M15.4 8.6l-1.9 4.9-4.9 1.9 1.9-4.9z" />
  </Stroke>
);
export const ExternalIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M9 5.5h9.5V15M18.3 5.7L6 18" />
  </Stroke>
);
export const SearchIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Stroke>
);
export const WalletIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M18.5 8V6.5A2 2 0 0 0 16.5 4.5H6.5A2.5 2.5 0 0 0 4 7v10a2.5 2.5 0 0 0 2.5 2.5h12a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 18.5 8H6.5" />
    <path d="M16 13.8h.01" />
  </Stroke>
);

// Platform glyphs (Simple Icons, CC0), filled with currentColor.
function Glyph({ size = 18, className, d }: IconProps & { d: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d={d} />
    </svg>
  );
}
export const AppleGlyph = (p: IconProps) => (
  <Glyph
    {...p}
    d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
  />
);
export const PlayGlyph = (p: IconProps) => (
  <Glyph
    {...p}
    d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z"
  />
);
export const ChromeGlyph = (p: IconProps) => (
  <Glyph
    {...p}
    d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"
  />
);
