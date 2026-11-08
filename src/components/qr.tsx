import createQr from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

/**
 * Código QR dibujado con react-native-svg (sin módulos nativos: funciona en Expo Go y web).
 * `level` = corrección de errores (M por defecto; H si se superpone un logo).
 */
export function QrCode({
  value,
  size = 200,
  color = colors.text,
  background = colors.white,
  level = 'M',
}: {
  value: string;
  size?: number;
  color?: string;
  background?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
}) {
  const { path, count } = useMemo(() => {
    const qr = createQr(0, level);
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value, level]);

  const margin = 2; // zona de silencio (módulos)
  const box = count + margin * 2;
  return (
    <View accessibilityRole="image" accessibilityLabel="Código QR de retiro">
      <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`}>
        <Rect x={0} y={0} width={box} height={box} fill={background} />
        <Path d={path} fill={color} transform={`translate(${margin} ${margin})`} />
      </Svg>
    </View>
  );
}

/** Anillo que se vacía mientras corre la cuenta regresiva (ej. vigencia del QR dinámico). */
export function CountdownRing({
  value,
  total,
  size = 28,
  stroke = 3,
  color = colors.primary,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const progress = Math.max(0, Math.min(1, value / total));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceHigh} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${length} ${length}`}
        strokeDashoffset={length * (1 - progress)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
