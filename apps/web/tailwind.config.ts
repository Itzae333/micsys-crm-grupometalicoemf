import type { Config } from 'tailwindcss';
import cauce from './tailwind.cauce';

const config: Config = {
  darkMode: cauce.darkMode as Config['darkMode'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: cauce.theme?.extend ?? {} },
  plugins: [],
};

export default config;
