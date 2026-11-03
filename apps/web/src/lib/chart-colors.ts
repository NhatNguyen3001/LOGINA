// Tremor's chart colour helpers (Apache License 2.0, https://github.com/tremorlabs/tremor), with LOGINA's chart colours.
// accent is the "revised" and "final" teal, mark the navy for progress, control the grey for "kept" and "first".

export type ColorUtility = 'bg' | 'stroke' | 'fill' | 'text';

export const chartColors = {
  accent: { bg: 'bg-accent', stroke: 'stroke-accent', fill: 'fill-accent', text: 'text-accent' },
  mark: { bg: 'bg-mark', stroke: 'stroke-mark', fill: 'fill-mark', text: 'text-mark' },
  control: { bg: 'bg-control', stroke: 'stroke-control', fill: 'fill-control', text: 'text-control' },
} as const satisfies Record<string, Record<ColorUtility, string>>;

export type AvailableChartColorsKeys = keyof typeof chartColors;

export const AvailableChartColors = Object.keys(chartColors) as AvailableChartColorsKeys[];

export const constructCategoryColors = (categories: string[], colors: AvailableChartColorsKeys[]): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>();
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]!);
  });
  return categoryColors;
};

export const getColorClassName = (color: AvailableChartColorsKeys, type: ColorUtility): string => chartColors[color]?.[type] ?? chartColors.control[type];

export const getYAxisDomain = (autoMinValue: boolean, minValue: number | undefined, maxValue: number | undefined) => {
  const minDomain = autoMinValue ? 'auto' : (minValue ?? 0);
  const maxDomain = maxValue ?? 'auto';
  return [minDomain, maxDomain];
};

export function hasOnlyOneValueForKey(array: Record<string, unknown>[], keyToCheck: string): boolean {
  const values: unknown[] = [];
  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      values.push(obj[keyToCheck]);
      if (values.length > 1) return false;
    }
  }
  return true;
}
