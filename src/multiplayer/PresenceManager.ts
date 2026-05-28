import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Vector3, UserPresence } from '../types';

const PRESENCE_COLLECTION = 'presence';
const HEARTBEAT_INTERVAL = 5000;
const INACTIVE_THRESHOLD = 15000;

export type PresenceState = 'active' | 'idle' | 'inactive';

export interface PresenceData {
  userId: string;
  roomId: string;
  position: Vector3;
  rotation: Vector3;
  lastSeen: Timestamp;
  isActive: boolean;
  color?: string;
  displayName?: string;
}

interface PresenceCallbacks {
  onUpdate?: (presences: PresenceData[]) => void;
  onUserJoin?: (userId: string) => void;
  onUserLeave?: (userId: string) => void;
  onStateChange?: (userId: string, state: PresenceState) => void;
}

const USER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
  '#F0B27A',
  '#82E0AA',
];

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

export class PresenceManager {
  private roomId: string;
  private userId: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private presenceRef: ReturnType<typeof doc> | null = null;
  private unsubscribe: Unsubscribe | null = null;
  private callbacks: PresenceCallbacks = {};
  private currentPresences: Map<string, PresenceData> = new Map();
  private connectionStateCleanup: (() => void) | null = null;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.presenceRef = doc(
      db,
      'rooms',
      roomId,
      PRESENCE_COLLECTION,
      userId
    );
  }

  async trackPresence(
    position: Vector3,
    rotation: Vector3
  ): Promise<void> {
    const presenceData: Omit<PresenceData, 'userId'> = {
      roomId: this.roomId,
      position,
      rotation,
      lastSeen: serverTimestamp() as Timestamp,
      isActive: true,
      color: getRandomColor(),
    };

    await setDoc(this.presenceRef!, {
      ...presenceData,
      userId: this.userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    this.startHeartbeat();
    this.setupConnectionCleanup();
  }

  async updatePresence(
    position: Vector3,
    rotation: Vector3
  ): Promise<void> {
    if (!this.presenceRef) return;

    await updateDoc(this.presenceRef, {
      position,
      rotation,
      lastSeen: serverTimestamp(),
      isActive: true,
      updatedAt: serverTimestamp(),
    });
  }

  subscribeToPresence(
    callback: (presences: PresenceData[]) => void,
    callbacks?: PresenceCallbacks
  ): Unsubscribe {
    if (callbacks) {
      this.callbacks = callbacks;
    }

    const presenceCollection = collection(
      db,
      'rooms',
      this.roomId,
      PRESENCE_COLLECTION
    );
    const q = query(presenceCollection, where('isActive', '==', true));

    this.unsubscribe = onSnapshot(q, (snapshot) => {
      const presences: PresenceData[] = [];
      const previousUserIds = new Set(this.currentPresences.keys());
      const currentUserIds = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data() as PresenceData;
        const presenceUserId = doc.id;
        currentUserIds.add(presenceUserId);

        const lastSeen = data.lastSeen?.toDate?.() ?? new Date();
        const timeSinceLastSeen = Date.now() - lastSeen.getTime();
        const isStillActive = timeSinceLastSeen < INACTIVE_THRESHOLD;

        if (isStillActive) {
          presences.push({
            ...data,
            userId: presenceUserId,
            isActive: isStillActive,
          });
        }

        const previousPresence = this.currentPresences.get(presenceUserId);
        if (!previousPresence && isStillActive) {
          this.callbacks.onUserJoin?.(presenceUserId);
          this.callbacks.onStateChange?.(presenceUserId, 'active');
        } else if (previousPresence) {
          const prevState = this.getStateFromPresence(previousPresence);
          const newState = this.getStateFromPresence({
            ...data,
            userId: presenceUserId,
            isActive: isStillActive,
          });

          if (prevState !== newState) {
            this.callbacks.onStateChange?.(presenceUserId, newState);
          }
        }
      });

      for (const previousUserId of previousUserIds) {
        if (!currentUserIds.has(previousUserId)) {
          this.callbacks.onUserLeave?.(previousUserId);
          this.currentPresences.delete(previousUserId);
        }
      }

      this.currentPresences.clear();
      for (const presence of presences) {
        this.currentPresences.set(presence.userId, presence);
      }

      callback(presences);
    });

    return this.unsubscribe!;
  }

  private getStateFromPresence(presence: PresenceData): PresenceState {
    const lastSeen = presence.lastSeen?.toDate?.() ?? new Date();
    const timeSinceLastSeen = Date.now() - lastSeen.getTime();

    if (timeSinceLastSeen < HEARTBEAT_INTERVAL * 2) {
      return 'active';
    } else if (timeSinceLastSeen < INACTIVE_THRESHOLD) {
      return 'idle';
    }
    return 'inactive';
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(async () => {
      if (!this.presenceRef) return;

      try {
        await updateDoc(this.presenceRef, {
          lastSeen: serverTimestamp(),
          isActive: true,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setupConnectionCleanup(): void {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = () => {
      this.markInactive();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.markInactive();
      } else if (document.visibilityState === 'visible') {
        this.markActive();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    this.connectionStateCleanup = () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }

  private async markInactive(): Promise<void> {
    if (!this.presenceRef) return;

    try {
      await updateDoc(this.presenceRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to mark inactive:', error);
    }
  }

  private async markActive(): Promise<void> {
    if (!this.presenceRef) return;

    try {
      await updateDoc(this.presenceRef, {
        isActive: true,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to mark active:', error);
    }
  }

  async cleanup(): Promise<void> {
    this.stopHeartbeat();
    this.connectionStateCleanup?.();

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.presenceRef) {
      try {
        await deleteDoc(this.presenceRef);
      } catch (error) {
        console.error('Failed to cleanup presence:', error);
      }
    }

    this.currentPresences.clear();
    this.callbacks = {};
  }

  getPresences(): PresenceData[] {
    return Array.from(this.currentPresences.values());
  }

  getPresenceForUser(userId: string): PresenceData | undefined {
    return this.currentPresences.get(userId);
  }

  getUserCount(): number {
    return this.currentPresences.size;
  }

  getUserId(): string {
    return this.userId;
  }
}

export async function trackPresence(
  roomId: string,
  userId: string,
  position: Vector3,
  rotation: Vector3
): Promise<void> {
  const presenceRef = doc(
    db,
    'rooms',
    roomId,
    PRESENCE_COLLECTION,
    userId
  );

  const presenceData = {
    userId,
    roomId,
    position,
    rotation,
    lastSeen: serverTimestamp(),
    isActive: true,
    color: getRandomColor(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(presenceRef, {
    ...presenceData,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToPresence(
  roomId: string,
  callback: (presences: PresenceData[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const presenceCollection = collection(
    db,
    'rooms',
    roomId,
    PRESENCE_COLLECTION
  );
  const q = query(presenceCollection, where('isActive', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const presences: PresenceData[] = [];
      const now = Date.now();

      snapshot.forEach((doc) => {
        const data = doc.data() as PresenceData;
        const lastSeen = data.lastSeen?.toDate?.() ?? new Date();
        const timeSinceLastSeen = now - lastSeen.getTime();

        if (timeSinceLastSeen < INACTIVE_THRESHOLD) {
          presences.push({
            ...data,
            userId: doc.id,
            isActive: true,
          });
        }
      });

      callback(presences);
    },
    (error) => {
      onError?.(error);
    }
  );
}
