import { useWindowDimensions } from 'react-native';
import { MAX_APP_WIDTH } from '@/theme/tokens';

export const useContentWidth = () => Math.min(useWindowDimensions().width, MAX_APP_WIDTH);
