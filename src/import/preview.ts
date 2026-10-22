import type { PkSystem, PkMember, PkSwitch, PkGroup } from './formats';

export interface PluralKitPreview {
  source: 'pluralkit';
  system: PkSystem;
  members: PkMember[];
  switches: PkSwitch[];
  groups: PkGroup[];
}

export type ExtPreview = PluralKitPreview;
