import {
  doc,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
  runTransaction,
  DocumentReference,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { SyncOperation, Transform, ConflictResolution } from '../types';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

export interface SyncEvent {
  type: 'update' | 'create' | 'delete' | 'conflict';
  objectId: string;
  data?: DocumentData;
  timestamp: number;
}

interface PendingOperation {
  id: string;
  objectId: string;
  changes: Partial<DocumentData>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface BatchedWrite {
  operations: PendingOperation[];
  timer: ReturnType<typeof setTimeout> | null;
  flushInterval: number;
}

interface ConflictEntry {
  objectId: string;
  localVersion: DocumentData;
  remoteVersion: DocumentData;
  resolvedAt: number;
}

export class SyncEngine {
  private roomId: string;
  private userId: string;
  private connectionState: ConnectionState = 'connected';
  private pendingOperations: Map<string, PendingOperation> = new Map();
  private batchedWrite: BatchedWrite;
  private operationCounter: number = 0;
  private listeners: Map<string, Unsubscribe> = new Map();
  private eventCallbacks: Array<(event: SyncEvent) => void> = [];
  private stateCallbacks: Array<(state: ConnectionState) => void> = [];
  private conflictLog: ConflictEntry[] = [];
  private retryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private flushPromise: Promise<void> | null = null;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.batchedWrite = {
      operations: [],
      timer: null,
      flushInterval: 100,
    };
    this.setupConnectionMonitoring();
  }

  private setupConnectionMonitoring(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.handleReconnect());
    window.addEventListener('offline', () => this.handleDisconnect());
  }

  private handleDisconnect(): void {
    this.connectionState = 'disconnected';
    this.notifyStateCallbacks();
  }

  private handleReconnect(): void {
    this.connectionState = 'reconnecting';
    this.notifyStateCallbacks();
    this.retryPendingOperations().then(() => {
      this.connectionState = 'connected';
      this.notifyStateCallbacks();
    });
  }

  private notifyStateCallbacks(): void {
    for (const callback of this.stateCallbacks) {
      callback(this.connectionState);
    }
  }

  private generateOperationId(): string {
    this.operationCounter++;
    return `${this.userId}-${Date.now()}-${this.operationCounter}`;
  }

  async sendLocalUpdate(
    objectId: string,
    changes: Partial<DocumentData>
  ): Promise<void> {
    const operation: PendingOperation = {
      id: this.generateOperationId(),
      objectId,
      changes,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 5,
    };

    this.pendingOperations.set(operation.id, operation);
    this.batchedWrite.operations.push(operation);

    if (this.batchedWrite.operations.length >= 10) {
      await this.flushBatch();
    } else if (!this.batchedWrite.timer) {
      this.batchedWrite.timer = setTimeout(
        () => this.flushBatch(),
        this.batchedWrite.flushInterval
      );
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchedWrite.timer) {
      clearTimeout(this.batchedWrite.timer);
      this.batchedWrite.timer = null;
    }

    const operations = [...this.batchedWrite.operations];
    this.batchedWrite.operations = [];

    if (operations.length === 0) return;

    if (this.connectionState === 'disconnected') {
      this.batchedWrite.operations = operations;
      return;
    }

    try {
      const batch = writeBatch(db);
      const opsByObject = new Map<string, PendingOperation[]>();

      for (const op of operations) {
        const existing = opsByObject.get(op.objectId) || [];
        existing.push(op);
        opsByObject.set(op.objectId, existing);
      }

      for (const [objectId, ops] of opsByObject) {
        const mergedChanges = this.mergeChanges(ops);
        const objectRef = doc(
          db,
          'rooms',
          this.roomId,
          'objects',
          objectId
        );
        batch.update(objectRef, {
          ...mergedChanges,
          updatedAt: serverTimestamp(),
          lastModifiedBy: this.userId,
        });
      }

      await batch.commit();

      for (const op of operations) {
        this.pendingOperations.delete(op.id);
        this.retryTimers.delete(op.id);
      }
    } catch (error) {
      console.error('Batch flush failed:', error);
      await this.handleBatchFailure(operations);
    }
  }

  private mergeChanges(
    operations: PendingOperation[]
  ): Partial<DocumentData> {
    const merged: Partial<DocumentData> = {};
    for (const op of operations) {
      Object.assign(merged, op.changes);
    }
    return merged;
  }

  private async handleBatchFailure(
    operations: PendingOperation[]
  ): Promise<void> {
    for (const op of operations) {
      op.retryCount++;
      if (op.retryCount <= op.maxRetries) {
        this.pendingOperations.set(op.id, op);
        const delay = Math.min(1000 * Math.pow(2, op.retryCount), 30000);
        const timer = setTimeout(() => {
          this.retryOperation(op);
        }, delay);
        this.retryTimers.set(op.id, timer);
      } else {
        this.pendingOperations.delete(op.id);
        this.emitEvent({
          type: 'conflict',
          objectId: op.objectId,
          timestamp: Date.now(),
        });
      }
    }
  }

  private async retryOperation(operation: PendingOperation): Promise<void> {
    try {
      const objectRef = doc(
        db,
        'rooms',
        this.roomId,
        'objects',
        operation.objectId
      );
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(objectRef);
        if (!docSnap.exists()) return;

        const currentData = docSnap.data();
        const resolved = this.resolveConflictLocal(
          currentData,
          operation.changes
        );
        transaction.update(objectRef, {
          ...resolved,
          updatedAt: serverTimestamp(),
          lastModifiedBy: this.userId,
        });
      });

      this.pendingOperations.delete(operation.id);
      this.retryTimers.delete(operation.id);
    } catch (error) {
      console.error('Retry failed for operation:', operation.id, error);
    }
  }

  private async retryPendingOperations(): Promise<void> {
    const pending = Array.from(this.pendingOperations.values());
    if (pending.length === 0) return;

    const batch = writeBatch(db);
    const opsByObject = new Map<string, PendingOperation[]>();

    for (const op of pending) {
      const existing = opsByObject.get(op.objectId) || [];
      existing.push(op);
      opsByObject.set(op.objectId, existing);
    }

    for (const [objectId, ops] of opsByObject) {
      const mergedChanges = this.mergeChanges(ops);
      const objectRef = doc(db, 'rooms', this.roomId, 'objects', objectId);
      batch.update(objectRef, {
        ...mergedChanges,
        updatedAt: serverTimestamp(),
        lastModifiedBy: this.userId,
      });
    }

    await batch.commit();

    for (const op of pending) {
      this.pendingOperations.delete(op.id);
    }
  }

  private resolveConflictLocal(
    currentData: DocumentData,
    incomingChanges: Partial<DocumentData>
  ): Partial<DocumentData> {
    const resolved: Partial<DocumentData> = {};

    for (const [key, incomingValue] of Object.entries(incomingChanges)) {
      const currentValue = currentData[key];

      if (
        typeof incomingValue === 'object' &&
        incomingValue !== null &&
        !Array.isArray(incomingValue) &&
        typeof currentValue === 'object' &&
        currentValue !== null &&
        !Array.isArray(currentValue)
      ) {
        resolved[key] = this.resolveConflictLocal(currentValue, incomingValue);
      } else if (typeof incomingValue === 'number' && typeof currentValue === 'number') {
        resolved[key] = Math.max(currentValue, incomingValue);
      } else {
        resolved[key] = incomingValue;
      }
    }

    return resolved;
  }

  resolveConflict(
    local: DocumentData,
    remote: DocumentData
  ): ConflictResolution {
    const localTimestamp = local.updatedAt?.toMillis?.() ?? 0;
    const remoteTimestamp = remote.updatedAt?.toMillis?.() ?? 0;

    const entry: ConflictEntry = {
      objectId: local.id || 'unknown',
      localVersion: local,
      remoteVersion: remote,
      resolvedAt: Date.now(),
    };
    this.conflictLog.push(entry);

    if (remoteTimestamp >= localTimestamp) {
      return { strategy: 'lastWriteWins', resolved: remote, source: 'remote' };
    }
    return { strategy: 'lastWriteWins', resolved: local, source: 'local' };
  }

  applyRemoteUpdate(objectData: DocumentData): void {
    this.emitEvent({
      type: 'update',
      objectId: objectData.id,
      data: objectData,
      timestamp: Date.now(),
    });
  }

  subscribeToObject(
    objectId: string,
    callback: (data: DocumentData | null) => void
  ): Unsubscribe {
    const objectRef = doc(
      db,
      'rooms',
      this.roomId,
      'objects',
      objectId
    );

    const unsubscribe = onSnapshot(objectRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });

    this.listeners.set(`object-${objectId}`, unsubscribe);
    return unsubscribe;
  }

  subscribeToAllObjects(
    callback: (objects: DocumentData[]) => void
  ): Unsubscribe {
    const objectsRef = collection(
      db,
      'rooms',
      this.roomId,
      'objects'
    );

    const unsubscribe = onSnapshot(objectsRef, (snapshot) => {
      const objects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(objects);
    });

    this.listeners.set('all-objects', unsubscribe);
    return unsubscribe;
  }

  onEvent(callback: (event: SyncEvent) => void): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  onConnectionStateChange(
    callback: (state: ConnectionState) => void
  ): () => void {
    this.stateCallbacks.push(callback);
    return () => {
      this.stateCallbacks = this.stateCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  private emitEvent(event: SyncEvent): void {
    for (const callback of this.eventCallbacks) {
      callback(event);
    }
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  getPendingOperationCount(): number {
    return this.pendingOperations.size;
  }

  getConflictLog(): ConflictEntry[] {
    return [...this.conflictLog];
  }

  async flush(): Promise<void> {
    await this.flushBatch();
  }

  destroy(): void {
    if (this.batchedWrite.timer) {
      clearTimeout(this.batchedWrite.timer);
    }

    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }

    for (const unsubscribe of this.listeners.values()) {
      unsubscribe();
    }

    this.listeners.clear();
    this.pendingOperations.clear();
    this.retryTimers.clear();
    this.eventCallbacks = [];
    this.stateCallbacks = [];
  }
}
