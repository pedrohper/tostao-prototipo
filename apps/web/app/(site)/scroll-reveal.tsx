'use client';
import { useEffect } from 'react';

/**
 * Faz os blocos da landing (`[data-reveal]`) entrarem quando aparecem na tela.
 * Sem JS, ou com "reduzir movimento" ligado, nada é escondido: o CSS só esconde depois de `data-armed`.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-lp]');
    if (!root) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).setAttribute('data-in', '');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );

    root.setAttribute('data-armed', '');
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
      root.removeAttribute('data-armed');
      root.querySelectorAll('[data-in]').forEach((el) => el.removeAttribute('data-in'));
    };
  }, []);

  return null;
}
