'use client';
import { useState } from 'react';

/**
 * <img> que troca de arquivo UMA vez se o primeiro falhar (ex.: SVG que não existe → PNG).
 * `onError` não pode ficar num Server Component (função não atravessa servidor → cliente), por isso este wrapper.
 * A flag `didFallback` impede o loop: se o fallback também der 404, o handler não roda de novo.
 */
export function ImgWithFallback({
  src,
  fallbackSrc,
  alt,
  ...rest
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & { src: string; fallbackSrc: string }) {
  const [current, setCurrent] = useState(src);
  const [didFallback, setDidFallback] = useState(false);
  return (
    <img
      {...rest}
      src={current}
      alt={alt}
      onError={() => {
        if (didFallback) return;
        setDidFallback(true);
        setCurrent(fallbackSrc);
      }}
    />
  );
}
