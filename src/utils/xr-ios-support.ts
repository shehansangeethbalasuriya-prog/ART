/**
 * iOS AR Support via ARKit
 * Provides fallback AR capabilities for iOS devices using ARKit integration
 * This bridges the gap until iOS Safari supports WebXR natively
 */

interface ARKitFrame {
  camera: {
    position: [number, number, number];
    eulerAngles: [number, number, number];
    arFrame?: any;
  };
  planes?: Array<{
    id: string;
    extent: [number, number];
    center: [number, number, number];
    alignment: 'horizontal' | 'vertical';
  }>;
  lightEstimate?: {
    ambientColorTemperature: number;
    ambientIntensity: number;
  };
}

interface ARKitHitTestResult {
  type: 'featurePoint' | 'existingPlane' | 'existingPlaneUsingExtent';
  worldTransform: Float32Array;
  localTransform?: Float32Array;
  anchor?: {
    identifier: string;
    worldTransform: Float32Array;
  };
}

interface IOSARSession {
  isActive: boolean;
  frameCallback: ((frame: ARKitFrame) => void) | null;
  hitTestCallback: ((results: ARKitHitTestResult[]) => void) | null;
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        arkit?: {
          postMessage: (message: any) => void;
        };
      };
    };
  }
}

class IOSARSupport {
  private static instance: IOSARSupport;
  private session: IOSARSession = {
    isActive: false,
    frameCallback: null,
    hitTestCallback: null,
  };
  private isARKitAvailable = false;

  private constructor() {
    this.detectARKitSupport();
    this.setupMessageHandling();
  }

  static getInstance(): IOSARSupport {
    if (!IOSARSupport.instance) {
      IOSARSupport.instance = new IOSARSupport();
    }
    return IOSARSupport.instance;
  }

  private detectARKitSupport(): void {
    // Check if we're on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS && window.webkit?.messageHandlers?.arkit) {
      this.isARKitAvailable = true;
    }
  }

  private setupMessageHandling(): void {
    // Listen for messages from native ARKit bridge
    (window as any).handleARKitFrame = (frame: ARKitFrame) => {
      if (this.session.frameCallback) {
        this.session.frameCallback(frame);
      }
    };

    (window as any).handleARKitHitTest = (results: ARKitHitTestResult[]) => {
      if (this.session.hitTestCallback) {
        this.session.hitTestCallback(results);
      }
    };
  }

  isAvailable(): boolean {
    return this.isARKitAvailable;
  }

  async startSession(): Promise<boolean> {
    if (!this.isARKitAvailable) {
      return false;
    }

    try {
      window.webkit?.messageHandlers?.arkit?.postMessage({
        command: 'startSession',
        options: {
          planeDetection: 'horizontal',
          lightEstimation: true,
          frameRate: 60,
        },
      });

      this.session.isActive = true;
      return true;
    } catch (error) {
      console.error('Failed to start ARKit session:', error);
      return false;
    }
  }

  async endSession(): Promise<void> {
    if (!this.isARKitAvailable) return;

    try {
      window.webkit?.messageHandlers?.arkit?.postMessage({
        command: 'endSession',
      });

      this.session.isActive = false;
    } catch (error) {
      console.error('Failed to end ARKit session:', error);
    }
  }

  onFrame(callback: (frame: ARKitFrame) => void): void {
    this.session.frameCallback = callback;
  }

  onHitTest(callback: (results: ARKitHitTestResult[]) => void): void {
    this.session.hitTestCallback = callback;
  }

  hitTest(x: number, y: number): void {
    if (!this.isARKitAvailable) return;

    window.webkit?.messageHandlers?.arkit?.postMessage({
      command: 'hitTest',
      x,
      y,
      types: ['existingPlane', 'featurePoint'],
    });
  }

  getSessionState(): {
    isActive: boolean;
    hasARKit: boolean;
  } {
    return {
      isActive: this.session.isActive,
      hasARKit: this.isARKitAvailable,
    };
  }
}

/**
 * Web-based AR fallback for iOS
 * Uses Three.js rendering with device motion/orientation for immersive experience
 */
class WebARFallback {
  private alpha = 0;
  private beta = 0;
  private gamma = 0;
  private lastAlpha = 0;
  private lastBeta = 0;
  private lastGamma = 0;

  constructor() {
    this.setupDeviceOrientation();
  }

  private setupDeviceOrientation(): void {
    if (typeof window === 'undefined') return;

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      this.alpha = event.alpha || 0;
      this.beta = event.beta || 0;
      this.gamma = event.gamma || 0;
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    }
  }

  getOrientation(): {
    alpha: number;
    beta: number;
    gamma: number;
  } {
    return {
      alpha: this.alpha,
      beta: this.beta,
      gamma: this.gamma,
    };
  }

  async requestPermission(): Promise<boolean> {
    if (typeof DeviceOrientationEvent === 'undefined') {
      return false;
    }

    // For iOS 13+, we need explicit permission
    if ((DeviceOrientationEvent as any).requestPermission) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Failed to request device orientation permission:', error);
        return false;
      }
    }

    return true;
  }
}

/**
 * Unified cross-platform AR support
 */
export class CrossPlatformAR {
  private iosAR: IOSARSupport;
  private webARFallback: WebARFallback;
  private platform: 'ios' | 'android' | 'web' = 'web';

  constructor() {
    this.iosAR = IOSARSupport.getInstance();
    this.webARFallback = new WebARFallback();
    this.detectPlatform();
  }

  private detectPlatform(): void {
    const ua = navigator.userAgent.toLowerCase();
    
    if (/iphone|ipad|ipod/.test(ua)) {
      this.platform = 'ios';
    } else if (/android/.test(ua)) {
      this.platform = 'android';
    }
  }

  /**
   * Check if true AR is available
   */
  async hasNativeAR(): Promise<boolean> {
    if (this.platform === 'ios') {
      return this.iosAR.isAvailable();
    }

    if (this.platform === 'android') {
      return (
        typeof navigator !== 'undefined' &&
        !!navigator.xr &&
        (await navigator.xr.isSessionSupported('immersive-ar'))
      );
    }

    return false;
  }

  /**
   * Check if Web AR fallback is available
   */
  async hasWebARFallback(): Promise<boolean> {
    if (this.platform === 'ios' || this.platform === 'android') {
      return await this.webARFallback.requestPermission();
    }
    return false;
  }

  /**
   * Start AR session with automatic fallback
   */
  async startAR(options?: {
    preferWebAR?: boolean;
  }): Promise<'native' | 'web' | null> {
    const hasNative = await this.hasNativeAR();

    if (hasNative && !options?.preferWebAR) {
      try {
        await this.iosAR.startSession();
        return 'native';
      } catch (error) {
        console.warn('Native AR failed, falling back to Web AR:', error);
      }
    }

    // Try Web AR fallback
    const hasWeb = await this.hasWebARFallback();
    if (hasWeb) {
      return 'web';
    }

    return null;
  }

  /**
   * End AR session
   */
  async endAR(): Promise<void> {
    await this.iosAR.endSession();
  }

  /**
   * Register frame callback for native AR
   */
  onARFrame(callback: (frame: ARKitFrame) => void): void {
    this.iosAR.onFrame(callback);
  }

  /**
   * Register hit test callback
   */
  onARHitTest(callback: (results: ARKitHitTestResult[]) => void): void {
    this.iosAR.onHitTest(callback);
  }

  /**
   * Perform hit test (native AR)
   */
  hitTest(x: number, y: number): void {
    this.iosAR.hitTest(x, y);
  }

  /**
   * Get device orientation (Web AR fallback)
   */
  getDeviceOrientation(): { alpha: number; beta: number; gamma: number } {
    return this.webARFallback.getOrientation();
  }

  /**
   * Get current platform
   */
  getPlatform(): 'ios' | 'android' | 'web' {
    return this.platform;
  }

  /**
   * Get AR session state
   */
  getState(): {
    platform: 'ios' | 'android' | 'web';
    isActive: boolean;
    hasNativeAR: boolean;
  } {
    const state = this.iosAR.getSessionState();
    return {
      platform: this.platform,
      isActive: state.isActive,
      hasNativeAR: state.hasARKit,
    };
  }
}

// Singleton instance
export const crossPlatformAR = new CrossPlatformAR();
