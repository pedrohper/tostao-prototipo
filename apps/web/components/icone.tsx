import React from 'react';
import iconOverrides from '@/lib/icon-overrides.json';
import { ImgWithFallback } from './img-with-fallback';

const OVERRIDES = iconOverrides as Record<string, string>;

export interface IconProps {
  src: string;
  size?: number;
  alt?: string;
  className?: string;
}

export const ICON_SVGS: Record<string, React.ReactNode> = {
  // Category Icons (cat/)
  'cat/apostas': (
    <>
      <path d="M4 8l2-4 4 2" />
      <path d="M20 8l-2-4-4 2" />
      <rect x="3" y="8" width="18" height="12" rx="6" />
      <circle cx="8.5" cy="13.5" r="1.25" fill="currentColor" />
      <circle cx="15.5" cy="13.5" r="1.25" fill="currentColor" />
      <path d="M12 15v1.5m-1.5 0h3" />
      <path d="M10 9h4" />
      <path d="M11 11h2" />
    </>
  ),
  'cat/assinaturas': (
    <>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M10 1v4M14 1v4" />
      <path d="M14 11a3 3 0 1 0 0 3" />
      <path d="M14 9v2.5h2.5" />
    </>
  ),
  'cat/casa': (
    <>
      <path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22v-6h6v6" />
      <path d="M18 4v3.5" />
    </>
  ),
  'cat/comer-fora': (
    <>
      <circle cx="12" cy="12" r="7" />
      <path d="M3 4v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V4" />
      <path d="M5 12v9" />
      <path d="M19 4v17" />
      <path d="M19 4c-2 1-3 3-3 6h3" />
    </>
  ),
  'cat/compras': (
    <>
      <path d="M6 8h12l1 13H5L6 8z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
      <path d="M10 13h4" />
    </>
  ),
  'cat/delivery': (
    <>
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M6 18h6l3-8h4" />
      <path d="M17 10l-1-4h-3" />
      <rect x="3" y="8" width="5" height="5" rx="1" />
    </>
  ),
  'cat/entrada-outros': (
    <>
      <path d="M4 14h4l2 3h4l2-3h4v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5z" />
      <path d="M12 3v9M8 8l4 4 4-4" />
    </>
  ),
  'cat/estudo': (
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M6 6h10M6 10h7" />
      <path d="M4 19.5a2.5 2.5 0 0 1 2.5-2.5H20" />
    </>
  ),
  'cat/jogos': (
    <>
      <rect x="2" y="6" width="20" height="13" rx="6" />
      <path d="M6 12.5h4M8 10.5v4" />
      <circle cx="15.5" cy="11.5" r="1" fill="currentColor" />
      <circle cx="17.5" cy="13.5" r="1" fill="currentColor" />
    </>
  ),
  'cat/mercado': (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.5 12h11.5l2-9H6" />
    </>
  ),
  'cat/nao-conta': (
    <>
      <path d="M4 7h13M14 4l3 3-3 3" />
      <path d="M20 17H7M10 14l-3 3 3 3" />
    </>
  ),
  'cat/outros': (
    <>
      <path d="M12 2l9 5-9 5-9-5 9-5z" />
      <path d="M3 7.5v9l9 5 9-5v-9" />
      <path d="M12 12v9.5" />
    </>
  ),
  'cat/role': (
    <>
      <path d="M5 8h5v9a3 3 0 0 1-3 3H5a2 2 0 0 1-2-2V8z" />
      <path d="M3 11H1a2 2 0 0 0 2 2h0" />
      <path d="M14 8h5v9a3 3 0 0 1-3 3h-2a2 2 0 0 1-2-2V8z" />
      <path d="M21 11h2a2 2 0 0 1-2 2h0" />
      <path d="M8 4l1 2M16 4l-1 2" />
    </>
  ),
  'cat/salario': (
    <>
      <path d="M12 3c-1.5 0-3 1-3 3l-4 3.5a5 5 0 0 0-2 4c0 4.5 4.5 7.5 9 7.5s9-3 9-7.5a5 5 0 0 0-2-4L15 6c0-2-1.5-3-3-3z" />
      <path d="M12 11v6m-2-4.5c.5-.7 1.5-1 2-1s2 .5 2 1.2c0 1.5-3.5 1-3.5 2.5 0 .8 1 1.3 2 1.3s1.7-.5 2-1" />
    </>
  ),
  'cat/saude': (
    <>
      <rect x="3" y="10" width="12" height="7" rx="3.5" transform="rotate(-45 9 13.5)" />
      <path d="M6.5 11l6 6" />
      <path d="M17 4v6M14 7h6" />
    </>
  ),
  'cat/sem-categoria': (
    <>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" strokeDasharray="3 2" />
      <path d="M10 8.5a1.5 1.5 0 1 1 2 1.4c-.7.5-.9.9-.9 1.6M11.1 14h.01" />
    </>
  ),
  'cat/transporte': (
    <>
      <rect x="4" y="3" width="16" height="15" rx="3" />
      <path d="M4 9h16M4 14h16" />
      <circle cx="7.5" cy="15.5" r="1" fill="currentColor" />
      <circle cx="16.5" cy="15.5" r="1" fill="currentColor" />
      <path d="M6 18v3M18 18v3" />
    </>
  ),

  // Conectar (conectar/)
  'conectar/anotar': (
    <>
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z" />
      <path d="M15 3v5h5" />
      <path d="M8 12h5M8 16h8" />
    </>
  ),
  'conectar/banco': (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V11M9.5 21V11M14.5 21V11M19 21V11" />
      <path d="M12 3L3 8.5h18z" />
    </>
  ),
  'conectar/extrato': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </>
  ),

  // Jogo (jogo/)
  'jogo/batalha': (
    <>
      <path d="M4 20l5-5M6 22l-2-2 1-3 4 4-3 1z" />
      <path d="M20 4l-9 9" />
      <path d="M20 20l-5-5M18 22l2-2-1-3-4 4 3 1z" />
      <path d="M4 4l9 9" />
    </>
  ),
  'jogo/dia-cumprido': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-5" strokeWidth="2.5" />
    </>
  ),
  'jogo/tribunal': (
    <>
      <path d="M14 6l4 4-8 8-4-4 8-8z" />
      <path d="M16 4l4 4M9 11l-5 5M3 21h8" />
    </>
  ),
  'jogo/vilao-derrotado': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 9l2 2M10 9l-2 2" />
      <path d="M14 9l2 2M16 9l-2 2" />
      <path d="M9 16c1-1 4-1 6 0" />
    </>
  ),

  // Meta (meta/)
  'meta/outro': (
    <>
      <circle cx="12" cy="4" r="2" />
      <path d="M19 11c0-4-3-6-7-6S5 7 5 11c0 3 2 5 4 6v3h3v-2h2v2h3v-3c2-1 2-4 2-6z" />
      <path d="M19 12h2a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-2" />
      <circle cx="8" cy="10" r="1" fill="currentColor" />
    </>
  ),
  'meta/reserva': (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M4 12h4M16 12h4M12 4v4M12 16v4" />
    </>
  ),
  'meta/sair-do-vermelho': (
    <>
      <path d="M3 15h18" strokeDasharray="3 2" />
      <path d="M4 19l6-6 4 4 7-8" strokeWidth="2" />
      <path d="M17 9h4v4" />
    </>
  ),
  'meta/viagem': (
    <>
      <path d="M12 3l2 7 6 2-3 2 1 4-4-2-3 2 1-5z" />
      <path d="M4 19c4-1 8-2 13-3" strokeDasharray="2 2" />
    </>
  ),

  // Modulos (modulo/)
  'modulo/1': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'modulo/2': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M3 10h18" />
      <path d="M7 14h3" />
    </>
  ),
  'modulo/3': (
    <>
      <path d="M8 8l8 8M14 6l4 4-8 8-4-4 8-8z" />
      <circle cx="6" cy="18" r="3" />
    </>
  ),
  'modulo/4': (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M3 14h18" />
      <path d="M8 5v5M16 5v5M12 10v4M7 14v5M15 14v5" />
    </>
  ),
  'modulo/5': (
    <>
      <path d="M12 21V10" />
      <path d="M12 14c-4 0-6-3-6-6 3 0 6 2 6 6z" />
      <path d="M12 11c4 0 6-3 6-5-3 0-6 2-6 5z" />
      <circle cx="12" cy="21" r="1.5" />
    </>
  ),
  'modulo/6': (
    <>
      <rect x="2" y="6" width="20" height="13" rx="3" />
      <path d="M16 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0z" />
      <path d="M5 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
    </>
  ),
  'modulo/7': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 7v2M12 15v2M7 12h2M15 12h2" />
    </>
  ),
  'modulo/8': (
    <>
      <path d="M3 20h18" />
      <path d="M5 16l5-6 4 3 5-7" strokeWidth="2" />
      <path d="M15 6h4v4" />
    </>
  ),
  'modulo/9': (
    <>
      <path d="M12 3s8 3 8 9c0 6-8 9-8 9s-8-3-8-9c0-6 8-9 8-9z" />
      <circle cx="12" cy="11" r="2" />
      <path d="M12 13v2" />
    </>
  ),

  // UI (ui/)
  'ui/banco': (
    <>
      <path d="M3 21h18" />
      <path d="M5 21V11M9.5 21V11M14.5 21V11M19 21V11" />
      <path d="M12 3L3 8.5h18z" />
    </>
  ),
  'ui/cartao': (
    <>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </>
  ),
  'ui/categorizar-ia': (
    <>
      <path d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
      <path d="M19 14l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z" />
    </>
  ),
  'ui/em-construcao': (
    <>
      <path d="M10 3h4l5 15H5L10 3z" />
      <path d="M7 13h10M8.5 8h7" />
      <path d="M3 21h18" />
    </>
  ),
  'ui/meta-batida': (
    <>
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H4a2 2 0 0 0-2 2v1a3 3 0 0 0 3 3h3" />
      <path d="M16 6h4a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3h-3" />
      <path d="M12 14v4M8 21h8" />
      <polygon
        points="12 6.5 12.8 8.2 14.6 8.3 13.2 9.5 13.7 11.2 12 10.2 10.3 11.2 10.8 9.5 9.4 8.3 11.2 8.2"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  'ui/minhas-categorias': (
    <>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </>
  ),
  'ui/ofensiva': (
    <>
      <path d="M12 2c1 3.5 4 5.5 4 9a6 6 0 1 1-12 0c0-3 2-6 5-8 0 2 1.5 3.5 3 3.5 0-2 .5-3.5 0-4.5z" />
    </>
  ),
  'ui/preferencias': (
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  'ui/sobre': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  'ui/whatsapp-chat': (
    <>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8.5z" />
    </>
  ),
  'ui/xp': (
    <>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </>
  ),

  // Abas (aba/)
  'aba/inicio': <path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  'aba/inicio-ativo': <path d="M3 10.5L12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="var(--color-amarelo)" />,
  'aba/carteira': (
    <>
      <rect x="2" y="6" width="20" height="13" rx="3" />
      <path d="M16 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0z" />
      <path d="M5 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
    </>
  ),
  'aba/carteira-ativo': (
    <>
      <rect x="2" y="6" width="20" height="13" rx="3" fill="var(--color-amarelo)" />
      <path d="M16 12a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0z" />
      <path d="M5 6V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
    </>
  ),
  'aba/tostao': <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  'aba/tostao-ativo': (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="var(--color-amarelo)" />
  ),
  'aba/aprender': (
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M4 19.5a2.5 2.5 0 0 1 2.5-2.5H20" />
    </>
  ),
  'aba/aprender-ativo': (
    <>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" fill="var(--color-amarelo)" />
      <path d="M4 19.5a2.5 2.5 0 0 1 2.5-2.5H20" />
    </>
  ),
  'aba/perfil': (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  'aba/perfil-ativo': (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="var(--color-amarelo)" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  'aba/mais': (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="15.5" cy="12" r="1" />
    </>
  ),
  'aba/mais-ativo': (
    <>
      <circle cx="12" cy="12" r="9" fill="var(--color-amarelo)" />
      <circle cx="8.5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="15.5" cy="12" r="1" fill="currentColor" />
    </>
  ),
};

/** Ícones desenhados em vetor (inline ou public/icones). Todos têm fundo transparente; o tamanho é o lado em px. */
export function Icon({ src, size = 24, alt = '', className = '' }: IconProps) {
  const customSrc = OVERRIDES[src];
  if (customSrc) {
    return (
      <img
        src={customSrc}
        width={size}
        height={size}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        className={`shrink-0 object-contain select-none ${className}`}
        draggable={false}
      />
    );
  }
  const iconContent = ICON_SVGS[src];
  if (iconContent) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={alt ? undefined : true}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        className={`shrink-0 ${className}`}
      >
        {iconContent}
      </svg>
    );
  }
  return (
    <ImgWithFallback
      src={`/icones/${src}.svg`}
      fallbackSrc={`/icones/${src}.png`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      className={`shrink-0 ${className}`}
      draggable={false}
    />
  );
}

const CATEGORIAS_COM_ICONE = new Set([
  'apostas',
  'assinaturas',
  'casa',
  'comer-fora',
  'compras',
  'delivery',
  'entrada-outros',
  'estudo',
  'jogos',
  'mercado',
  'nao-conta',
  'outros',
  'role',
  'salario',
  'saude',
  'sem-categoria',
  'transporte',
]);

/** Ícone da categoria: desenho próprio pras do sistema, emoji pras que a pessoa criou. */
export function CatIcon({
  id,
  emoji,
  size = 24,
}: {
  id: string | null | undefined;
  emoji?: string | null;
  size?: number;
}) {
  if (id && CATEGORIAS_COM_ICONE.has(id)) return <Icon src={`cat/${id}`} size={size} />;
  return (
    <span aria-hidden="true" style={{ fontSize: size * 0.75, lineHeight: 1 }}>
      {emoji ?? '🏷️'}
    </span>
  );
}
