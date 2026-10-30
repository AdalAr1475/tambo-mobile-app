import { colors } from '@/theme/tokens';
import { Icon } from './Icon';
import { Row, Txt } from './ui';

export function SummaryRow({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  tone?: 'discount' | 'success';
}) {
  const color = tone === 'discount' ? colors.wine : tone === 'success' ? colors.success : colors.text;
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row style={{ gap: 6, flexShrink: 1 }}>
        {icon && <Icon name={icon} size={18} color={tone === 'discount' ? colors.wine : colors.textMuted} />}
        <Txt variant="bodyMd" color={tone === 'discount' ? colors.wine : colors.text}>
          {label}
        </Txt>
      </Row>
      <Txt variant="labelLg" color={color}>
        {value}
      </Txt>
    </Row>
  );
}
