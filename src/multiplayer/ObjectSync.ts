import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
  writeBatch,
  Unsubscribe,
  DocumentData,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Vector3, Transform } from '../types';

const OBJECTS_SUBCOLLECTION = 'objects';

export interface ObjectUpdate {
  objectId: string;
  changes: Partial<DocumentData>;
  timestamp: number;
  version: number;
}

export interface SyncState {
  isConnected: boolean;
  pendingUpdates: number;
  lastSyncTime: number;
  latency: number;
}

export type SyncStateCallback = (state: SyncState) => void;
export type ObjectUpdateCallback = (objectId: string, data: DocumentData | null) => void;

interface VersionedObject {
  version: number;
  lastUpdated: number;
  data: DocumentData;
}

export class ObjectSyncEngine {
  private roomId: string;
  private userId: string;
  private unsubscribe: Unsubscribe | null = null;
  private localVersions: Map<string, VersionedObject> = new Map();
  private pendingUpdates: Map<string, ObjectUpdate> = new Map();
  private stateCallbacks: SyncStateCallback[] = [];
  private objectCallbacks: ObjectUpdateCallback[] = [];
  private syncState: SyncState = {
    isConnected: true,
    pendingUpdates: 0,
    lastSyncTime: Date.now(),
    latency: 0,
  };
  private latencyMeasures: number[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private batchQueue: ObjectUpdate[] = [];
  private batchInterval = 50;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  applyRemoteUpdate(objectData: DocumentData): void {
    const objectId = objectData.id as string;
    const remoteVersion = (objectData.version as number) || 0;
    const localVersion = this.localVersions.get(objectId);

    if (localVersion && localVersion.version > remoteVersion) {
      return;
    }

    if (localVersion && localVersion.version === remoteVersion) {
      const resolved = this.resolveConflict(
        { ...localVersion.data, id: objectId },
        objectData
      );
      this.localVersions.set(objectId, {
        version: Math.max(localVersion.version, remoteVersion) + 1,
        lastUpdated: Date.now(),
        data: resolved,
      });
    } else {
      this.localVersions.set(objectId, {
        version: remoteVersion + 1,
        lastUpdated: Date.now(),
        data: objectData,
      });
    }

    this.notifyObjectCallbacks(objectId, objectData);
  }

  async sendLocalUpdate(
    objectId: string,
    changes: Partial<DocumentData>
  ): Promise<void> {
    const localVersion = this.localVersions.get(objectId);
    const newVersion = (localVersion?.version || 0) + 1;

    const update: ObjectUpdate = {
      objectId,
      changes,
      timestamp: Date.now(),
      version: newVersion,
    };

    this.localVersions.set(objectId, {
      version: newVersion,
      lastUpdated: Date.now(),
      data: {
        ...(localVersion?.data || {}),
        ...changes,
        id: objectId,
      },
    });

    this.batchQueue.push(update);
    this.pendingUpdates.set(objectId, update);
    this.updateSyncState();

    this.scheduleBatchFlush();
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimer) return;

    if (this.batchQueue.length >= 10) {
      this.flushBatch();
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, this.batchInterval);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const updates = [...this.batchQueue];
    this.batchQueue = [];

    if (updates.length === 0) return;

    const start = Date.now();

    try {
      const batch = writeBatch(db);

      for (const update of updates) {
        const objectRef = doc(
          db,
          'rooms',
          this.roomId,
          OBJECTS_SUBCOLLECTION,
          update.objectId
        );

        batch.update(objectRef, {
          ...update.changes,
          version: update.version,
          lastModifiedBy: this.userId,
          updatedAt: serverTimestamp(),
        });

        this.pendingUpdates.delete(update.objectId);
      }

      await batch.commit();

      const latency = Date.now() - start;
      this.latencyMeasures.push(latency);
      if (this.latencyMeasures.length > 20) {
        this.latencyMeasures.shift();
      }

      this.syncState.lastSyncTime = Date.now();
      this.syncState.latency = this.getAverageLatency();
      this.updateSyncState();
    } catch (error) {
      console.error('Batch flush failed:', error);
      for (const update of updates) {
        this.pendingUpdates.set(update.objectId, update);
      }
      this.updateSyncState();
    }
  }

  resolveConflict(
    local: DocumentData,
    remote: DocumentData
  ): DocumentData {
    const localTimestamp = local.updatedAt?.toMillis?.() ?? 0;
    const remoteTimestamp = remote.updatedAt?.toMillis?.() ?? 0;

    if (remoteTimestamp > localTimestamp) {
      return remote;
    }

    if (localTimestamp > remoteTimestamp) {
      return local;
    }

    const localVersion = (local.version as number) || 0;
    const remoteVersion = (remote.version as number) || 0;

    if (remoteVersion > localVersion) {
      return remote;
    }

    const resolved: DocumentData = { ...local };

    for (const [key, value] of Object.entries(remote)) {
      if (key === 'id' || key === 'version' || key === 'updatedAt' || key === 'createdAt') {
        continue;
      }

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const localValue = resolved[key];
        if (typeof localValue === 'object' && localValue !== null && !Array.isArray(localValue)) {
          resolved[key] = this.resolveConflict(localValue, value);
          continue;
        }
      }

      resolved[key] = value;
    }

    resolved.version = Math.max(localVersion, remoteVersion) + 1;
    return resolved;
  }

  interpolatePosition(
    from: Vector3,
    to: Vector3,
    t: number
  ): Vector3 {
    const easedT = this.easeInOutCubic(t);

    return {
      x: from.x + (to.x - from.x) * easedT,
      y: from.y + (to.y - from.y) * easedT,
      z: from.z + (to.z - from.z) * easedT,
    };
  }

  interpolateRotation(
    from: Vector3,
    to: Vector3,
    t: number
  ): Vector3 {
    const easedT = this.easeInOutCubic(t);

    return {
      x: from.x + (to.x - from.x) * easedT,
      y: from.y + (to.y - from.y) * easedT,
      z: from.z + (to.z - from.z) * easedT,
    };
  }

  interpolateTransform(
    from: Transform,
    to: Transform,
    t: number
  ): Transform {
    return {
      position: this.interpolatePosition(from.position, to.position, t),
      rotation: { ...this.interpolateRotation(from.rotation, to.rotation, t), w: 1 },
      scale: this.interpolatePosition(from.scale, to.scale, t),
    };
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private getAverageLatency(): number {
    if (this.latencyMeasures.length === 0) return 0;
    const sum = this.latencyMeasures.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyMeasures.length);
  }

  subscribeToObject(
    objectId: string,
    callback: (data: DocumentData | null) => void
  ): Unsubscribe {
    const objectRef = doc(
      db,
      'rooms',
      this.roomId,
      OBJECTS_SUBCOLLECTION,
      objectId
    );

    return onSnapshot(objectRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = { id: snapshot.id, ...snapshot.data() };
        this.applyRemoteUpdate(data);
        callback(data);
      } else {
        this.localVersions.delete(objectId);
        callback(null);
      }
    });
  }

  subscribeToAllObjects(
    callback: (objects: DocumentData[]) => void
  ): Unsubscribe {
    const objectsRef = collection(
      db,
      'rooms',
      this.roomId,
      OBJECTS_SUBCOLLECTION
    );

    this.unsubscribe = onSnapshot(objectsRef, (snapshot) => {
      const objects: DocumentData[] = [];

      snapshot.docChanges().forEach((change) => {
        const data = { id: change.doc.id, ...change.doc.data() };

        if (change.type === 'added' || change.type === 'modified') {
          this.applyRemoteUpdate(data);
        } else if (change.type === 'removed') {
          this.localVersions.delete(change.doc.id);
        }
      });

      snapshot.forEach((doc) => {
        objects.push({ id: doc.id, ...doc.data() });
      });

      callback(objects);
    });

    return this.unsubscribe;
  }

  onSyncStateChange(callback: SyncStateCallback): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter((cb) => cb !== callback);
    };
  }

  onObjectUpdate(callback: ObjectUpdateCallback): () => void {
    this.objectCallbacks.push(callback);
    return () => {
      this.objectCallbacks = this.objectCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  private notifyObjectCallbacks(
    objectId: string,
    data: DocumentData
  ): void {
    for (const callback of this.objectCallbacks) {
      callback(objectId, data);
    }
  }

  private updateSyncState(): void {
    this.syncState.isConnected = true;
    this.syncState.pendingUpdates = this.pendingUpdates.size;

    for (const callback of this.stateCallbacks) {
      callback({ ...this.syncState });
    }
  }

  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  getLocalVersion(objectId: string): number {
    return this.localVersions.get(objectId)?.version || 0;
  }

  getPendingUpdates(): ObjectUpdate[] {
    return Array.from(this.pendingUpdates.values());
  }

  hasPendingUpdates(): boolean {
    return this.pendingUpdates.size > 0;
  }

  async forceFlush(): Promise<void> {
    await this.flushBatch();
  }

  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.localVersions.clear();
    this.pendingUpdates.clear();
    this.batchQueue = [];
    this.stateCallbacks = [];
    this.objectCallbacks = [];
  }
}

export function interpolatePosition(
  from: Vector3,
  to: Vector3,
  t: number
): Vector3 {
  const clampedT = Math.max(0, Math.min(1, t));
  const easedT = clampedT < 0.5
    ? 4 * clampedT * clampedT * clampedT
    : 1 - Math.pow(-2 * clampedT + 2, 3) / 2;

  return {
    x: from.x + (to.x - from.x) * easedT,
    y: from.y + (to.y - from.y) * easedT,
    z: from.z + (to.z - from.z) * easedT,
  };
}
