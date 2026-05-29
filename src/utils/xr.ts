import { CrossPlatformAR, crossPlatformAR } from './xr-ios-support';
import { deviceOrientationHandler, deviceMotionHandler } from './device-orientation';

interface ARSupportResult {
  supported: boolean;
  reason?: string;
  features?: string[];
  browser?: string;
  platform?: string;
  platformAR?: 'native' | 'web' | 'none';
  requiresHTTPS?: boolean;
}

interface XRState {
  status: 'idle' | 'requesting' | 'active' | 'ended' | 'error';
  mode?: string;
  error?: string;
  arType?: 'native' | 'web';
}

function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let platform = 'Unknown';

  if (/android/i.test(ua)) {
    platform = 'Android';
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/samsung/i.test(ua)) browser = 'Samsung Browser';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
  } else if (/iphone|ipad/i.test(ua)) {
    platform = 'iOS';
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/chrome/i.test(ua)) browser = 'Chrome';
  } else if (/mac/i.test(ua)) {
    platform = 'macOS';
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua)) browser = 'Safari';
  } else if (/win/i.test(ua)) {
    platform = 'Windows';
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/edg/i.test(ua)) browser = 'Edge';
  } else if (/linux/i.test(ua)) {
    platform = 'Linux';
    if (/chrome/i.test(ua)) browser = 'Chrome';
  }

  return { browser, platform };
}

/**
 * Check if WebXR AR is supported on this device.
 * Supports both native AR and web-based fallbacks across iOS and Android.
 */
export async function checkARSupport(): Promise<ARSupportResult> {
  const { browser, platform } = getBrowserInfo();
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';

  if (!isSecure) {
    return {
      supported: false,
      reason: 'HTTPS required for AR. Please access via HTTPS.',
      browser,
      platform,
      platformAR: 'none',
      requiresHTTPS: true,
    };
  }

  if (typeof navigator === 'undefined') {
    return {
      supported: false,
      reason: 'Browser does not support WebXR',
      browser,
      platform,
      platformAR: 'none',
    };
  }

  // Check for native AR support
  let nativeARSupported = false;
  let webARSupported = false;

  // Android: Check for WebXR
  if (platform === 'Android' && navigator.xr) {
    try {
      nativeARSupported = await navigator.xr.isSessionSupported('immersive-ar');
    } catch (err) {
      console.warn('Failed to check Android WebXR support:', err);
    }
  }

  // iOS: Check for ARKit via native bridge
  if (platform === 'iOS') {
    const hasNative = await crossPlatformAR.hasNativeAR();
    nativeARSupported = hasNative;
  }

  // Check for Web AR fallback (device orientation + motion)
  const hasOrientationPermission = await deviceOrientationHandler.requestPermission();
  const hasMotionPermission = await deviceMotionHandler.requestPermission();
  webARSupported = hasOrientationPermission && hasMotionPermission;

  // Determine overall support
  if (nativeARSupported) {
    return {
      supported: true,
      features: ['immersive-ar', 'hit-test', 'plane-detection', 'anchors'],
      browser,
      platform,
      platformAR: 'native',
    };
  }

  if (webARSupported) {
    return {
      supported: true,
      features: ['device-orientation', 'device-motion', 'web-ar'],
      reason:
        platform === 'iOS'
          ? `${browser} on ${platform}: Using device orientation for 3D preview mode`
          : `${browser} on ${platform}: WebXR not available, using 3D preview mode`,
      browser,
      platform,
      platformAR: 'web',
    };
  }

  // No AR support available
  let reason = 'AR not supported on this device.';
  if (platform === 'iOS') {
    reason = `iOS (${browser}): Device orientation permission denied. Please enable motion & orientation access in Settings > Safari > Motion & Orientation Access.`;
  } else if (platform === 'Android') {
    reason = `Android (${browser}): WebXR not available. Ensure Chrome 81+ is installed and location services are enabled.`;
  } else if (platform === 'Windows' || platform === 'macOS' || platform === 'Linux') {
    reason = `${platform}: Desktop browsers have limited AR support. Use an Android or iOS device for full AR experience.`;
  }

  return {
    supported: false,
    reason,
    browser,
    platform,
    platformAR: 'none',
  };
}

/**
 * Request an immersive-ar session with optional features (Android WebXR).
 */
export async function requestARSession(
  features: string[] = ['hit-test', 'dom-overlay']
): Promise<XRSession> {
  if (!navigator.xr) {
    throw new Error('WebXR not available');
  }

  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: features,
    optionalFeatures: ['hit-test', 'dom-overlay', 'anchors', 'plane-detection'],
    domOverlay: { root: document.getElementById('ar-overlay') as Element ?? undefined },
  });

  return session;
}

/**
 * Set up a hit test source for an XR session (Android WebXR).
 */
export async function getHitTestSource(
  session: XRSession,
  referenceSpace?: XRReferenceSpace
): Promise<XRHitTestSource | null> {
  const space = referenceSpace ?? (await session.requestReferenceSpace('local'));

  const hitTestSource = await session.requestHitTestSource?.({
    space,
    entityTypes: ['plane'],
  });

  return hitTestSource ?? null;
}

/**
 * Format XR state into a human-readable string.
 */
export function formatXRState(state: XRState): string {
  const arType = state.arType ? ` (${state.arType})` : '';
  switch (state.status) {
    case 'idle':
      return 'Ready';
    case 'requesting':
      return 'Requesting AR session...';
    case 'active':
      return `Active${state.mode ? ` (${state.mode})` : ''}${arType}`;
    case 'ended':
      return 'Session ended';
    case 'error':
      return `Error: ${state.error ?? 'Unknown error'}`;
    default:
      return 'Unknown state';
  }
}

/**
 * Create a reference space from a session (Android WebXR).
 */
export async function getReferenceSpace(
  session: XRSession,
  type: XRReferenceSpaceType = 'local'
): Promise<XRReferenceSpace> {
  return session.requestReferenceSpace(type);
}

/**
 * Get the viewer pose for a frame (Android WebXR).
 */
export function getViewerPose(
  frame: XRFrame,
  referenceSpace: XRReferenceSpace
): XRPose | null {
  try {
    return frame.getViewerPose(referenceSpace) ?? null;
  } catch {
    return null;
  }
}

/**
 * Get cross-platform AR support information
 */
export function getCrossPlatformARInfo() {
  const state = crossPlatformAR.getState();
  return {
    platform: state.platform,
    isActive: state.isActive,
    hasNativeAR: state.hasNativeAR,
    deviceOrientationPermission: deviceOrientationHandler.hasOrientationPermission(),
    deviceMotionPermission: deviceMotionHandler.hasMotionPermission(),
  };
}

/**
 * Request all necessary permissions for cross-platform AR
 */
export async function requestAllARPermissions(): Promise<boolean> {
  const supportResult = await checkARSupport();

  if (!supportResult.supported) {
    return false;
  }

  // Request device orientation permission (iOS 13+)
  await deviceOrientationHandler.requestPermission();

  // Request device motion permission (iOS 13+)
  await deviceMotionHandler.requestPermission();

  return true;
}

/**
 * Detect if running on iOS
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Detect if running on Android
 */
export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

/**
 * Detect if running on mobile
 */
export function isMobile(): boolean {
  return isIOS() || isAndroid();
}

export { CrossPlatformAR, crossPlatformAR };
export { deviceOrientationHandler, deviceMotionHandler };
