import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationUpdatePayload {
  lat: number;
  lng: number;
  speedMph: number;
  accuracy: number;
}

/**
 * Check if app is running as a native Android or iOS application
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Check specifically if running as native Android
 */
export function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Request all required native location permissions on Android (Fine, Coarse)
 */
export async function requestNativeLocationPermissions(): Promise<boolean> {
  if (!isNativeApp()) {
    return true;
  }

  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === 'granted' || status.coarseLocation === 'granted') {
      return true;
    }

    const requested = await Geolocation.requestPermissions();
    return requested.location === 'granted' || requested.coarseLocation === 'granted';
  } catch (err) {
    console.warn('Native permission request warning:', err);
    return false;
  }
}

/**
 * Start high-accuracy native location watcher
 */
export async function startNativeLocationWatcher(
  onLocation: (coords: LocationUpdatePayload) => void,
  onError?: (err: any) => void
): Promise<string | number> {
  if (isNativeApp()) {
    try {
      await requestNativeLocationPermissions();
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        },
        (position, err) => {
          if (err) {
            onError?.(err);
            return;
          }
          if (position?.coords) {
            const speedMph = position.coords.speed
              ? Math.round(position.coords.speed * 2.23694)
              : 0;
            onLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              speedMph,
              accuracy: position.coords.accuracy || 5,
            });
          }
        }
      );
      return watchId;
    } catch (err) {
      onError?.(err);
    }
  }

  // Web fallback using browser navigator.geolocation
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const speedMph = pos.coords.speed ? Math.round(pos.coords.speed * 2.23694) : 0;
        onLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedMph,
          accuracy: pos.coords.accuracy || 10,
        });
      },
      (err) => onError?.(err),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );
    return id;
  }

  return 0;
}

/**
 * Clear location watcher
 */
export async function clearNativeLocationWatcher(watchId: string | number): Promise<void> {
  if (isNativeApp() && typeof watchId === 'string') {
    try {
      await Geolocation.clearWatch({ id: watchId });
    } catch {}
    return;
  }

  if (typeof watchId === 'number' && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}
