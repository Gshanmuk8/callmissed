import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Notice({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className="notice" role="alert">
      <span>{children}</span>
      {onDismiss && (
        <button className="icon-button" aria-label="Dismiss message" onClick={onDismiss}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
