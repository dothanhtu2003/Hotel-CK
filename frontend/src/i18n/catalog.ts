import { t, type TranslationKey } from './index';

// These are controlled legacy catalog aliases, mapped to stable internal resource keys.
// Unknown names/descriptions and all personal information pass through unchanged.
export const serviceKeys: Readonly<Record<string, TranslationKey>> = {
  'Bữa sáng': 'common:catalog.breakfast', 'Cà phê': 'common:catalog.coffee',
  'Giặt ủi': 'common:catalog.laundry', 'Nước suối': 'common:catalog.water', 'Bữa tối': 'common:catalog.dinner',
};
const roomKeys: Readonly<Record<string, TranslationKey>> = {
  Standard: 'common:catalog.standard', Deluxe: 'common:catalog.deluxe', Suite: 'common:catalog.suite',
};
function catalogKey(name: string): TranslationKey | undefined {
  return Object.hasOwn(serviceKeys, name) ? serviceKeys[name] : Object.hasOwn(roomKeys, name) ? roomKeys[name] : undefined;
}
export function catalogName(name: string): string;
export function catalogName(name: undefined): undefined;
export function catalogName(name: string | undefined): string | undefined;
export function catalogName(name: string | undefined): string | undefined {
  const key = name ? catalogKey(name) : undefined;
  return key ? t(key) : name;
}
export function catalogDescription(value: string | null | undefined, entityName: string): string | null | undefined {
  const keys: Record<string, TranslationKey> = {
    'Dịch vụ tại khách sạn': 'common:catalog.hotelService',
    'Phòng Standard': 'common:catalog.standardDescription',
    'Phòng Deluxe': 'common:catalog.deluxeDescription',
    'Phòng Suite': 'common:catalog.suiteDescription',
  };
  const approved = (Object.hasOwn(serviceKeys, entityName) && value === 'Dịch vụ tại khách sạn')
    || (Object.hasOwn(roomKeys, entityName) && value === `Phòng ${entityName}`);
  return approved && value && keys[value] ? t(keys[value]) : value;
}
