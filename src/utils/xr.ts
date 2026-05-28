interface ARSupportResult {
  supported: boolean;
  reason?: string;
  features?: string[];
  browser?: string;
  platform?: string;
  requiresHTTPS?: boolean;
}

interface XRState {
  status: 'idle' | 'requesting' | 'active' | 'ended' | 'error';
  mode?: string;
  error?: string;
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
      requiresHTTPS: true,
    };
  }

  if (typeof navigator === 'undefined') {
    return {
      supported: false,
      reason: 'Browser does not support WebXR',
      browser,
      platform,
    };
  }

  if (!navigator.xr) {
    let reason = 'WebXR not available in this browser.';
    if (platform === 'iOS') {
      reason = 'iOS Safari does not support WebXR. Use Android Chrome for AR, or try the 3D preview mode.';
    } else if (platform === 'Windows' || platform === 'macOS' || platform === 'Linux') {
      reason = 'Desktop browsers have limited AR support. Use Android Chrome for full AR experience.';
    }
    return { supported: false, reason, browser, platform };
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (supported) {
      return {
        supported: true,
        features: ['immersive-ar', 'hit-test', 'plane-detection', 'anchors'],
        browser,
        platform,
      };
    }

    return {
      supported: false,
      reason: `immersive-ar not supported on ${browser} (${platform}). Use Android Chrome with ARCore for best experience.`,
      browser,
      platform,
    };
  } catch (err) {
    return {
      supported: false,
      reason: err instanceof Error ? err.message : 'Unknown error checking AR support',
      browser,
      platform,
    };
  }
}

/**
 * Request an immersive-ar session with optional features.
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
 * Set up a hit test source for an XR session.
 */
export async function getHitTestSource(
  session: XRSession,
  referenceSpace?: XRReferenceSpace
): Promise<XRHitTestSource | null> {
  const space = referenceSpace ?? await session.requestReferenceSpace('local');

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
  switch (state.status) {
    case 'idle':
      return 'Ready';
    case 'requesting':
      return 'Requesting AR session...';
    case 'active':
      return `Active${state.mode ? ` (${state.mode})` : ''}`;
    case 'ended':
      return 'Session ended';
    case 'error':
      return `Error: ${state.error ?? 'Unknown error'}`;
    default:
      return 'Unknown state';
  }
}

/**
 * Create a reference space from a session.
 */
export async function getReferenceSpace(
  session: XRSession,
  type: XRReferenceSpaceType = 'local'
): Promise<XRReferenceSpace> {
  return session.requestReferenceSpace(type);
}

/**
 * Get the viewer pose for a frame.
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
