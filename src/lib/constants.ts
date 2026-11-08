import type { Density } from './types';

// Values are sent to the server, which only accepts this same list.
export const LANGUAGES = [
  { value: 'auto', label: 'Same as the source' },
  { value: 'English', label: 'English' },
  { value: 'Vietnamese', label: 'Vietnamese' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Indonesian', label: 'Indonesian' },
  { value: 'Hindi', label: 'Hindi' },
];

export const DENSITIES: { value: Density; label: string; charsPerCard: number }[] = [
  { value: 'light', label: 'Light (key ideas only)', charsPerCard: 600 },
  { value: 'normal', label: 'Normal', charsPerCard: 350 },
  { value: 'thorough', label: 'Thorough (every detail)', charsPerCard: 220 },
];

export const MAX_SOURCE_CHARS = 600_000;
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
