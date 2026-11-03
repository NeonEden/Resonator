export const PATCH_DESTINATIONS: Record<string, readonly string[]> = {
  'lfo-out': ['vco-pitch', 'vcf-cut', 'vcf-res'],
  'noise-out': ['vcf-cut'],
  'sub-out': ['vco-pitch', 'vcf-res'],
};

export function isSupportedPatch(cable: { fromId: string; toId: string }): boolean {
  return PATCH_DESTINATIONS[cable.fromId]?.includes(cable.toId) ?? false;
}
