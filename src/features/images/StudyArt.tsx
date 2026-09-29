export function StudyArt({ kind }: { kind: 'arch' | 'bloom' }) {
  return kind === 'arch' ? (
    <svg
      viewBox="0 0 600 440"
      role="img"
      aria-label="Architectural study: terracotta steps and a sculptural arch"
    >
      <defs>
        <linearGradient id="archbg" x2="1" y2="1">
          <stop stopColor="#dce3d5" />
          <stop offset="1" stopColor="#b4c2b0" />
        </linearGradient>
        <linearGradient id="archface" x2="1" y2="0">
          <stop stopColor="#e7a079" />
          <stop offset="1" stopColor="#c77954" />
        </linearGradient>
      </defs>
      <path fill="url(#archbg)" d="M0 0h600v440H0z" />
      <ellipse cx="352" cy="366" rx="191" ry="34" fill="#354c39" opacity=".17" />
      <path d="M210 337V147a104 104 0 0 1 208 0v190h-61V150a43 43 0 0 0-86 0v187z" fill="#915434" />
      <path
        d="M181 324V134a104 104 0 0 1 208 0v190h-61V137a43 43 0 0 0-86 0v187z"
        fill="url(#archface)"
      />
      <path d="M121 346h277v23H121zM149 323h249v23H149zM177 301h221v22H177z" fill="#e5b393" />
      <path d="m398 301 40 25v67l-40-24z" fill="#aa7558" />
      <path d="m121 369 277 0 40 24H161z" fill="#7d926f" opacity=".35" />
      <circle cx="490" cy="95" r="37" fill="#f3efcd" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 600 440"
      role="img"
      aria-label="Abstract study: a vermilion folded ribbon on pale lilac"
    >
      <defs>
        <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fd9b62" />
          <stop offset=".48" stopColor="#e95e35" />
          <stop offset="1" stopColor="#9b281b" />
        </linearGradient>
      </defs>
      <path d="M0 0h600v440H0z" fill="#dedcea" />
      <ellipse cx="305" cy="364" rx="160" ry="27" fill="#6a5375" opacity=".14" />
      <g transform="translate(300 217)">
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d="M0 0C-142-135 88-190 100-68C108 24 13 131 0 0Z"
            fill="url(#ribbon)"
            stroke="#a53927"
            strokeWidth=".45"
            transform={`rotate(${i * 40})`}
          />
        ))}
      </g>
      <circle cx="300" cy="217" r="17" fill="#712b22" />
    </svg>
  );
}
