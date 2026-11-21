import type { ChangeEvent, CSSProperties, InputHTMLAttributes } from 'react';

export type SliderTone = 'laranja' | 'amarelo' | 'alerta' | 'menta';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'min' | 'max' | 'step' | 'onChange'> & {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  tone?: SliderTone;
};

/** Quanto do trilho já está preenchido (0 a 100), seguro pra min = max e valor fora da régua. */
export function sliderPercent(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/**
 * Slider do design system. É um `<input type="range">` de verdade (setas, Home/End, leitor de tela e rótulo pelo
 * `<label>` que o envolve), só estilizado em `.tostao-slider` (globals.css). Mesma API do input: troca direta.
 */
export function TostaoSlider({ value, min, max, step = 1, onChange, tone = 'laranja', style, ...rest }: Props) {
  return (
    <input
      {...rest}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={onChange}
      data-tone={tone}
      className="tostao-slider"
      style={{ ...style, '--pct': `${sliderPercent(value, min, max)}%` } as CSSProperties}
    />
  );
}
