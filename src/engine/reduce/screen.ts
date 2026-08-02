import type { LocationId, Screen } from '../types';

export function screenForLocation(loc: LocationId): Screen {
  if (loc === 'suze-port') return 'suze';
  if (loc === 'fields-town') return 'ftown';
  if (loc === 'on-road') return 'ftown';
  if (loc === 'hideout') return 'hideout';
  if (loc === 'secret-mine') return 'secret-expedition';
  return 'camp';
}
