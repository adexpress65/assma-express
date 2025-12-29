// types/ionicons.d.ts
import '@expo/vector-icons';

declare module '@expo/vector-icons/Ionicons' {
  import { ComponentType } from 'react';
  import { IconProps } from '@expo/vector-icons';
  
  const Ionicons: ComponentType<IconProps>;
  export default Ionicons;
}
