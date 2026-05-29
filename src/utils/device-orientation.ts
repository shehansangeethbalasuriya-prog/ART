/**
 * Cross-platform device orientation handling
 * Provides normalized device orientation data for both iOS and Android
 */

export interface DeviceOrientation {
  alpha: number; // Z rotation (0-360)
  beta: number;  // X rotation (-180 to 180)
  gamma: number; // Y rotation (-90 to 90)
  roll: number;  // Roll in degrees
  pitch: number; // Pitch in degrees
  yaw: number;   // Yaw in degrees
}

export interface DeviceMotion {
  acceleration: { x: number; y: number; z: number };
  accelerationIncludingGravity: { x: number; y: number; z: number };
  rotationRate: { alpha: number; beta: number; gamma: number };
}

declare global {
  interface Window {
    DeviceOrientationEvent?: any;
    DeviceMotionEvent?: any;
  }
}

/**
 * Handle device orientation with permission support (iOS 13+)
 */
export class DeviceOrientationHandler {
  private listeners: Array<(orientation: DeviceOrientation) => void> = [];
  private currentOrientation: DeviceOrientation = {
    alpha: 0,
    beta: 0,
    gamma: 0,
    roll: 0,
    pitch: 0,
    yaw: 0,
  };
  private hasPermission = false;
  private isListening = false;

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    if (typeof window === 'undefined') return;

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      this.currentOrientation = {
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0,
        roll: this.eulerToRoll(event.alpha || 0, event.beta || 0, event.gamma || 0),
        pitch: this.eulerToPitch(event.alpha || 0, event.beta || 0, event.gamma || 0),
        yaw: this.eulerToYaw(event.alpha || 0, event.beta || 0, event.gamma || 0),
      };

      this.notifyListeners();
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    }
  }

  /**
   * Request permission for device orientation (iOS 13+)
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    // iOS 13+ requires explicit permission
    if ((DeviceOrientationEvent as any)?.requestPermission) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        this.hasPermission = permission === 'granted';
        return this.hasPermission;
      } catch (error) {
        console.error('Failed to request device orientation permission:', error);
        return false;
      }
    }

    // Android and older iOS don't require explicit permission
    this.hasPermission = true;
    return true;
  }

  /**
   * Start listening for orientation changes
   */
  startListening(): void {
    this.isListening = true;
  }

  /**
   * Stop listening for orientation changes
   */
  stopListening(): void {
    this.isListening = false;
    this.listeners = [];
  }

  /**
   * Subscribe to orientation changes
   */
  onChange(callback: (orientation: DeviceOrientation) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Get current orientation
   */
  getOrientation(): DeviceOrientation {
    return { ...this.currentOrientation };
  }

  /**
   * Get current permission status
   */
  hasOrientationPermission(): boolean {
    return this.hasPermission;
  }

  private notifyListeners(): void {
    if (!this.isListening) return;

    for (const listener of this.listeners) {
      listener({ ...this.currentOrientation });
    }
  }

  // Euler angle conversion helpers
  private eulerToRoll(alpha: number, beta: number, gamma: number): number {
    const radAlpha = (alpha * Math.PI) / 180;
    const radBeta = (beta * Math.PI) / 180;
    const radGamma = (gamma * Math.PI) / 180;

    const roll =
      Math.atan2(
        Math.sin(radAlpha) * Math.cos(radGamma) + Math.cos(radAlpha) * Math.sin(radBeta) * Math.sin(radGamma),
        Math.cos(radAlpha) * Math.cos(radGamma) - Math.sin(radAlpha) * Math.sin(radBeta) * Math.sin(radGamma)
      ) *
      (180 / Math.PI);

    return (roll + 360) % 360;
  }

  private eulerToPitch(alpha: number, beta: number, gamma: number): number {
    const radAlpha = (alpha * Math.PI) / 180;
    const radBeta = (beta * Math.PI) / 180;
    const radGamma = (gamma * Math.PI) / 180;

    const pitch =
      Math.asin(Math.cos(radAlpha) * Math.cos(radBeta) * Math.sin(radGamma) + Math.sin(radBeta) * Math.sin(radAlpha)) *
      (180 / Math.PI);

    return pitch;
  }

  private eulerToYaw(alpha: number, beta: number, gamma: number): number {
    const radAlpha = (alpha * Math.PI) / 180;
    const radBeta = (beta * Math.PI) / 180;
    const radGamma = (gamma * Math.PI) / 180;

    const yaw =
      Math.atan2(
        -Math.sin(radAlpha) * Math.cos(radBeta),
        Math.sin(radBeta)
      ) *
      (180 / Math.PI);

    return (yaw + 360) % 360;
  }
}

/**
 * Handle device motion (acceleration and rotation rate)
 */
export class DeviceMotionHandler {
  private listeners: Array<(motion: DeviceMotion) => void> = [];
  private currentMotion: DeviceMotion = {
    acceleration: { x: 0, y: 0, z: 0 },
    accelerationIncludingGravity: { x: 0, y: 0, z: 0 },
    rotationRate: { alpha: 0, beta: 0, gamma: 0 },
  };
  private hasPermission = false;
  private isListening = false;

  constructor() {
    this.initializeListeners();
  }

  private initializeListeners(): void {
    if (typeof window === 'undefined') return;

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      this.currentMotion = {
        acceleration: {
          x: event.acceleration?.x || 0,
          y: event.acceleration?.y || 0,
          z: event.acceleration?.z || 0,
        },
        accelerationIncludingGravity: {
          x: event.accelerationIncludingGravity?.x || 0,
          y: event.accelerationIncludingGravity?.y || 0,
          z: event.accelerationIncludingGravity?.z || 0,
        },
        rotationRate: {
          alpha: event.rotationRate?.alpha || 0,
          beta: event.rotationRate?.beta || 0,
          gamma: event.rotationRate?.gamma || 0,
        },
      };

      this.notifyListeners();
    };

    if (typeof DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', handleDeviceMotion, true);
    }
  }

  /**
   * Request permission for device motion (iOS 13+)
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    // iOS 13+ requires explicit permission
    if ((DeviceMotionEvent as any)?.requestPermission) {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        this.hasPermission = permission === 'granted';
        return this.hasPermission;
      } catch (error) {
        console.error('Failed to request device motion permission:', error);
        return false;
      }
    }

    // Android and older iOS don't require explicit permission
    this.hasPermission = true;
    return true;
  }

  /**
   * Start listening for motion changes
   */
  startListening(): void {
    this.isListening = true;
  }

  /**
   * Stop listening for motion changes
   */
  stopListening(): void {
    this.isListening = false;
    this.listeners = [];
  }

  /**
   * Subscribe to motion changes
   */
  onChange(callback: (motion: DeviceMotion) => void): () => void {
    this.listeners.push(callback);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Get current motion
   */
  getMotion(): DeviceMotion {
    return JSON.parse(JSON.stringify(this.currentMotion));
  }

  /**
   * Get current permission status
   */
  hasMotionPermission(): boolean {
    return this.hasPermission;
  }

  private notifyListeners(): void {
    if (!this.isListening) return;

    for (const listener of this.listeners) {
      listener(JSON.parse(JSON.stringify(this.currentMotion)));
    }
  }
}

// Singleton instances
export const deviceOrientationHandler = new DeviceOrientationHandler();
export const deviceMotionHandler = new DeviceMotionHandler();
