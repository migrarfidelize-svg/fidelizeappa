/** Local do estabelecimento, não rastreia a localização de clientes. */
export interface WalletProximitySettings {
  proximity_enabled: boolean;
  proximity_latitude: number | null;
  proximity_longitude: number | null;
}
export function getProximityLocations(settings: WalletProximitySettings): Array<{ latitude: number; longitude: number }> {
  const lat = settings.proximity_latitude;
  const lng = settings.proximity_longitude;
  if (!settings.proximity_enabled || lat == null || lng == null) return [];
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
  return [{ latitude: lat, longitude: lng }];
}
