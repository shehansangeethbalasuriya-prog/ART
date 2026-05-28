interface ARSupportResult {
  supported: boolean;
  reason?: string;
  features?: string[];
}

interface XRState {
  status: 'idle' | 'requesting' | 'active' | 'ended' | 'error';
  mode?: string;
  error?: string;
}

/**
 * Check if WebXR AR is supported on this device.
 */
export async function checkARSupport(): Promise<ARSupportResult> {
  if (typeof navigator === 'undefined' || !navigator.xr) {
    return { supported: false, reason: 'WebXR not available in this browser' };
  }

  try {
    const supported = await navigator.xr.isSessionSupported('immersive-ar');
    if (supported) {
      const features: string[] = ['immersive-ar'];
      try {
        const hitTestSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (hitTestSupported) features.push('hit-test');
      } catch {
        // hit-test not available
      }
      return { supported: true, features };
    }

    // Try fallback to immersive-vr
    const vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
    if (vrSupported) {
      return {
        supported: false,
        reason: 'Only immersive-vr supported, not immersive-ar',
      };
    }

    return { supported: false, reason: 'immersive-ar not supported' };
  } catch (err) {
    return {
      supported: false,
      reason: err instanceof Error ? err.message : 'Unknown error checking XR support',
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
