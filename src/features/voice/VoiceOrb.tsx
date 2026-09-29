import type { CSSProperties } from 'react';

export function VoiceOrb({ active = false, level = 0 }: { active?: boolean; level?: number }) {
  return (
    <div
      className={`orb ${active ? 'orb-active' : ''}`}
      style={{ '--level': level } as CSSProperties}
      aria-hidden="true"
    >
      <div className="orb-halo" />
      <svg className="orb-art" viewBox="0 0 420 420">
        <defs>
          <radialGradient id="orb-surface" cx="34%" cy="28%" r="78%">
            <stop offset="0" stopColor="#fcab7b" />
            <stop offset=".55" stopColor="#ed7144" />
            <stop offset="1" stopColor="#b53520" />
          </radialGradient>
          <clipPath id="orb-clip">
            <circle cx="210" cy="210" r="150" />
          </clipPath>
        </defs>
        <circle cx="210" cy="210" r="150" fill="url(#orb-surface)" />
        <g clipPath="url(#orb-clip)" fill="none" stroke="#592918" strokeWidth=".85" opacity=".65">
          {Array.from({ length: 57 }, (_, i) => (
            <ellipse
              key={i}
              cx="210"
              cy="210"
              rx={12 + i * 2.45}
              ry="150"
              transform={`rotate(${i * 3.1} 210 210)`}
            />
          ))}
        </g>
        <circle cx="210" cy="210" r="150" fill="none" stroke="#8b4628" strokeOpacity=".2" />
      </svg>
      <span className="orb-cross top">+</span>
      <span className="orb-cross bottom">+</span>
    </div>
  );
}
