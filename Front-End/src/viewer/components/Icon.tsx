import type { CSSProperties, ReactElement } from "react";

// Bộ icon nét vuông theo phong cách biển báo nhà ga (không dùng emoji). stroke = currentColor.
const PATHS = {
    back: <path d="M15 5l-7 7 7 7" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M21 14v7h-7" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>,
    check: <path d="M5 12l5 5 9-10" />,
    swap: <path d="M8 4v16M8 4l-3 3M8 4l3 3M16 20V4M16 20l-3-3M16 20l3-3" />,
    play: <path d="M6 4l14 8-14 8z" />,
    list: <path d="M4 7h16M4 12h16M4 17h10" />,
    locate: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></>,
    pin: <><path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></>,
    straight: <path d="M12 20V4M12 4l-6 6M12 4l6 6" />,
    depart: <path d="M12 20V4M12 4l-6 6M12 4l6 6" />,
    left: <path d="M18 20v-9a4 4 0 0 0-4-4H5M5 7l4-4M5 7l4 4" />,
    right: <path d="M6 20v-9a4 4 0 0 1 4-4h9M19 7l-4-4M19 7l-4 4" />,
    "slight-left": <path d="M15 20v-7L8 6M8 6v6M8 6h6" />,
    "slight-right": <path d="M9 20v-7l7-7M16 6v6M16 6h-6" />,
    uturn: <path d="M8 20V9a4 4 0 0 1 8 0v4M16 13l-3-3M16 13l3-3" />,
    "floor-up": <path d="M3 19h4l8-11h6M15 8l-3-1M15 8l1 3" />,
    "floor-down": <path d="M3 8h4l8 11h6M15 19l-3 1M15 19l1-3" />,
    arrive: <><path d="M6 21V4" /><path d="M6 4h11l-2 4 2 4H6" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="M15 9l-2 5-4 1 2-5z" /></>,
    walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6-2-3 1-5 4 3 3 1M12 15l3 2 1 4M11 7l-3 2-1 3" /></>,
    phone: <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2z" />,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    layers: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
    torch: <><path d="M8 2h8v4l-2 3v13H10V9L8 6z" /><path d="M10 13h4" /></>,
    vibrate: <><rect x="8" y="3" width="8" height="18" rx="1" /><path d="M4 9v6M20 9v6" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4" /></>,
    building: <><path d="M4 21V5l8-3 8 3v16" /><path d="M9 21v-5h6v5M8 8h2M14 8h2M8 12h2M14 12h2" /></>
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof PATHS;

interface IconProps {
    name: IconName;
    size?: number;
    stroke?: number;
    className?: string;
    style?: CSSProperties;
}

export default function Icon({ name, size = 20, stroke = 2.2, className, style }: IconProps) {
    return (
        <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={stroke} strokeLinecap="square" strokeLinejoin="miter" className={className} style={style}>
            {PATHS[name]}
        </svg>
    );
}
