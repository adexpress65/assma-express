import Colors from './colors';

export const theme = {
  colors: Colors,
  spacing: (n: number) => 4 * n,
  radius: 12,
  shadow: {
    elevation: 2,
  },
};

export default theme;