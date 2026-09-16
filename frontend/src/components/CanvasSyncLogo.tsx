import React from 'react';

interface CanvasSyncLogoProps {
  size?: number;
  showWordmark?: boolean;
  decorative?: boolean;
  className?: string;
}

const CanvasSyncLogo: React.FC<CanvasSyncLogoProps> = ({
  size = 44,
  showWordmark = false,
  decorative = false,
  className = ''
}) => (
  <span className={`canvassync-logo ${className}`.trim()} style={{ '--logo-size': `${size}px` } as React.CSSProperties}>
    <img
      className="canvassync-logo-mark"
      src="/canvassync-mark.svg"
      alt={decorative || showWordmark ? '' : 'CanvasSync'}
      aria-hidden={decorative || showWordmark ? true : undefined}
    />
    {showWordmark && <span className="canvassync-logo-wordmark">CanvasSync</span>}
  </span>
);

export default CanvasSyncLogo;
