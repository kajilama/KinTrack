import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { StatusBar, Style } from '@capacitor/status-bar';

export interface LocationUpdatePayload {
  lat: number;
  lng: number;
  speedMph: number;
  accuracy: number;
}

/**
 * Configure native Android / iOS system status bar so it never
 * overlays or blocks the top phone bar, signal, time, or controls.
 */
export async function configureNativeStatusBar(): Promise<void> {
  if (isNativeApp()) {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0b1120' });
      await StatusBar.show();
    } catch (err) {
      console.warn('Native StatusBar config notice:', err);
    }
  }
}

/**
 * Check current location permission status without prompting
 */
export async function checkLocationPermissionStatus(): Promise<'granted' | 'prompt' | 'denied'> {
  if (isNativeApp()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return 'granted';
      }
      if (status.location === 'denied') {
        return 'denied';
      }
      return 'prompt';
    } catch {
      return 'prompt';
    }
  }

  if (typeof navigator !== 'undefined' && (navigator as any).permissions) {
    try {
      const res = await (navigator as any).permissions.query({ name: 'geolocation' });
      return res.state || 'prompt';
    } catch {
      return 'prompt';
    }
  }

  return 'prompt';
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
 * Proactively request location permissions on Android, iOS, or Web.
 * Triggers the OS / browser system dialog:
 * "Allow KinTrack Family to access this device's location?"
 */
export async function requestLocationPermission(): Promise<boolean> {
  // 1. Native Capacitor (Android / iOS)
  if (isNativeApp()) {
    try {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return true;
      }

      const requested = await Geolocation.requestPermissions({
        permissions: ['location', 'coarseLocation'],
      });
      return requested.location === 'granted' || requested.coarseLocation === 'granted';
    } catch (err) {
      console.warn('Native Geolocation permission request error:', err);
    }
  }

  // 2. Standard Web & Android WebView fallback
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        (err) => {
          console.warn('Browser geolocation permission rejected or timed out:', err);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  return false;
}

/**
 * Proactively acquire device's live physical location.
 * Used on app boot, join circle, and create circle so pins are accurate from second 1.
 */
export async function getInitialLiveLocation(): Promise<LocationUpdatePayload | null> {
  // 1. Try Native Capacitor Geolocation
  if (isNativeApp()) {
    try {
      await requestLocationPermission();
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      });

      if (pos?.coords) {
        const speedMph = pos.coords.speed ? Math.round(pos.coords.speed * 2.23694) : 0;
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedMph,
          accuracy: pos.coords.accuracy || 8,
        };
      }
    } catch (err) {
      console.warn('Native getCurrentPosition failed, falling back:', err);
    }
  }

  // 2. Browser Geolocation fallback
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    return new Promise<LocationUpdatePayload | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const speedMph = pos.coords.speed ? Math.round(pos.coords.speed * 2.23694) : 0;
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speedMph,
            accuracy: pos.coords.accuracy || 10,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }

  return null;
}

/**
 * Start high-accuracy native location watcher
 */
export async function startNativeLocationWatcher(
  onLocation: (coords: LocationUpdatePayload) => void,
  onError?: (err: any) => void
): Promise<string | number> {
  // Always trigger permission request first
  await requestLocationPermission();

  if (isNativeApp()) {
    try {
      const watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 3000,
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
        maximumAge: 5000,
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
