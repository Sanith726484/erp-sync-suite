import * as Location from 'expo-location';
import { ErpClientManager } from 'standard-api';

export class LocationTracker {
  private static intervalId: any = null;
  private static currentUser: string | null = null;

  public static async requestPermissions(): Promise<boolean> {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        return false;
      }
      
      // Attempt background permissions if supported in execution context
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
      return bgStatus === 'granted' || fgStatus === 'granted';
    } catch (err) {
      console.error('[LocationTracker] Permission request error:', err);
      return false;
    }
  }

  public static startTracking(user: string, intervalSeconds: number = 900): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    
    this.currentUser = user;
    void this.trackNow(); // Initial immediate log

    this.intervalId = setInterval(() => {
      void this.trackNow();
    }, intervalSeconds * 1000);
  }

  public static stopTracking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.currentUser = null;
  }

  public static isTrackingActive(): boolean {
    return this.intervalId !== null;
  }

  public static async trackNow(): Promise<{ latitude: number; longitude: number } | null> {
    if (!this.currentUser) return null;
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        console.warn('[LocationTracker] Location services are disabled.');
        return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      const client = ErpClientManager.getClient();
      await client.saveGpsLocation(lat, lng, this.currentUser);
      
      return { latitude: lat, longitude: lng };
    } catch (err) {
      console.error('[LocationTracker] Location tracking failed:', err);
      return null;
    }
  }
}
