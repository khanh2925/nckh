import { createElement, type CSSProperties } from "react";
import { LUCIDE, type LucideName } from "./lucide";

export type { LucideName };

interface LcProps {
    name: LucideName;
    size?: number;
    /** Mặc định 1.75 như bản thiết kế */
    stroke?: number;
    color?: string;
    className?: string;
    style?: CSSProperties;
}

/** Bộ icon duy nhất của giao diện (Lucide, nét 1.75). Luôn aria-hidden: nút icon phải có aria-label. */
export default function Lc({ name, size = 18, stroke = 1.75, color = "currentColor", className, style }: LcProps) {
    return (
        <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeLinejoin="round" className={className} style={style} focusable="false">
            {LUCIDE[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
        </svg>
    );
}
