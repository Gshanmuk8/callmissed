export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? 'small' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        {[10, 19, 28, 19, 10].map((h, i) => (
          <i key={i} style={{ height: h }} />
        ))}
      </span>
      {!small && (
        <span>
          CallMissed<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
