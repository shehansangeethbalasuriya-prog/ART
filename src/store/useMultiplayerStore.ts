import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { RoomUser, Vector3, SyncStatus, PendingOperation } from '../types';

interface ObjectSyncState {
  lastSyncedObjectIds: string[];
  pendingObjectUpdates: string[];
  conflictObjects: string[];
}

interface ConnectionQuality {
  latency: number;
  bandwidth: number;
  packetLoss: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface MultiplayerStoreState {
  connectedUsers: Map<string, RoomUser>;
  userPositions: Map<string, Vector3>;
  objectSyncState: ObjectSyncState;
  connectionQuality: ConnectionQuality;
  syncStatus: SyncStatus;
  pendingOperations: PendingOperation[];
  lastSyncTimestamp: number | null;

  addConnectedUser: (user: RoomUser) => void;
  removeConnectedUser: (uid: string) => void;
  updateConnectedUser: (uid: string, updates: Partial<RoomUser>) => void;
  setConnectedUsers: (users: RoomUser[]) => void;
  clearConnectedUsers: () => void;

  setUserPosition: (uid: string, position: Vector3) => void;
  setUserRotation: (uid: string, rotation: Vector3) => void;
  removeUserPosition: (uid: string) => void;
  clearUserPositions: () => void;

  setLastSyncedObjects: (objectIds: string[]) => void;
  addPendingObjectUpdate: (objectId: string) => void;
  removePendingObjectUpdate: (objectId: string) => void;
  setConflictObjects: (objectIds: string[]) => void;
  resolveConflict: (objectId: string) => void;
  clearObjectSyncState: () => void;

  updateConnectionQuality: (quality: Partial<ConnectionQuality>) => void;
  setSyncStatus: (status: SyncStatus) => void;

  addPendingOperation: (operation: PendingOperation) => void;
  removePendingOperation: (operationId: string) => void;
  markOperationCompleted: (operationId: string) => void;
  retryOperation: (operationId: string) => void;
  clearPendingOperations: () => void;
  getRetryableOperations: () => PendingOperation[];

  setLastSyncTimestamp: (timestamp: number) => void;

  reset: () => void;
}

const initialConnectionQuality: ConnectionQuality = {
  latency: 0,
  bandwidth: 0,
  packetLoss: 0,
  quality: 'good',
};

const initialState = {
  connectedUsers: new Map<string, RoomUser>(),
  userPositions: new Map<string, Vector3>(),
  objectSyncState: {
    lastSyncedObjectIds: [],
    pendingObjectUpdates: [],
    conflictObjects: [],
  },
  connectionQuality: initialConnectionQuality,
  syncStatus: 'synced' as SyncStatus,
  pendingOperations: [],
  lastSyncTimestamp: null,
};

export const useMultiplayerStore = create<MultiplayerStoreState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      addConnectedUser: (user) =>
        set(
          (state) => {
            const newUsers = new Map(state.connectedUsers);
            newUsers.set(user.uid, user);
            return { connectedUsers: newUsers };
          },
          false,
          'addConnectedUser'
        ),

      removeConnectedUser: (uid) =>
        set(
          (state) => {
            const newUsers = new Map(state.connectedUsers);
            newUsers.delete(uid);
            const newPositions = new Map(state.userPositions);
            newPositions.delete(uid);
            return {
              connectedUsers: newUsers,
              userPositions: newPositions,
            };
          },
          false,
          'removeConnectedUser'
        ),

      updateConnectedUser: (uid, updates) =>
        set(
          (state) => {
            const newUsers = new Map(state.connectedUsers);
            const existingUser = newUsers.get(uid);
            if (existingUser) {
              newUsers.set(uid, { ...existingUser, ...updates });
            }
            return { connectedUsers: newUsers };
          },
          false,
          'updateConnectedUser'
        ),

      setConnectedUsers: (users) =>
        set(
          () => {
            const newUsers = new Map<string, RoomUser>();
            users.forEach((user) => newUsers.set(user.uid, user));
            return { connectedUsers: newUsers };
          },
          false,
          'setConnectedUsers'
        ),

      clearConnectedUsers: () =>
        set(
          {
            connectedUsers: new Map<string, RoomUser>(),
            userPositions: new Map<string, Vector3>(),
          },
          false,
          'clearConnectedUsers'
        ),

      setUserPosition: (uid, position) =>
        set(
          (state) => {
            const newPositions = new Map(state.userPositions);
            newPositions.set(uid, position);
            return { userPositions: newPositions };
          },
          false,
          'setUserPosition'
        ),

      setUserRotation: (uid, rotation) =>
        set(
          (state) => {
            const newPositions = new Map(state.userPositions);
            const existingPos = newPositions.get(uid) || {
              x: 0,
              y: 0,
              z: 0,
            };
            newPositions.set(uid, {
              ...existingPos,
              ...rotation,
            });
            return { userPositions: newPositions };
          },
          false,
          'setUserRotation'
        ),

      removeUserPosition: (uid) =>
        set(
          (state) => {
            const newPositions = new Map(state.userPositions);
            newPositions.delete(uid);
            return { userPositions: newPositions };
          },
          false,
          'removeUserPosition'
        ),

      clearUserPositions: () =>
        set(
          { userPositions: new Map<string, Vector3>() },
          false,
          'clearUserPositions'
        ),

      setLastSyncedObjects: (objectIds) =>
        set(
          (state) => ({
            objectSyncState: {
              ...state.objectSyncState,
              lastSyncedObjectIds: objectIds,
            },
          }),
          false,
          'setLastSyncedObjects'
        ),

      addPendingObjectUpdate: (objectId) =>
        set(
          (state) => ({
            objectSyncState: {
              ...state.objectSyncState,
              pendingObjectUpdates: [
                ...state.objectSyncState.pendingObjectUpdates.filter(
                  (id) => id !== objectId
                ),
                objectId,
              ],
            },
          }),
          false,
          'addPendingObjectUpdate'
        ),

      removePendingObjectUpdate: (objectId) =>
        set(
          (state) => ({
            objectSyncState: {
              ...state.objectSyncState,
              pendingObjectUpdates:
                state.objectSyncState.pendingObjectUpdates.filter(
                  (id) => id !== objectId
                ),
            },
          }),
          false,
          'removePendingObjectUpdate'
        ),

      setConflictObjects: (objectIds) =>
        set(
          (state) => ({
            objectSyncState: {
              ...state.objectSyncState,
              conflictObjects: objectIds,
            },
          }),
          false,
          'setConflictObjects'
        ),

      resolveConflict: (objectId) =>
        set(
          (state) => ({
            objectSyncState: {
              ...state.objectSyncState,
              conflictObjects: state.objectSyncState.conflictObjects.filter(
                (id) => id !== objectId
              ),
            },
          }),
          false,
          'resolveConflict'
        ),

      clearObjectSyncState: () =>
        set(
          {
            objectSyncState: {
              lastSyncedObjectIds: [],
              pendingObjectUpdates: [],
              conflictObjects: [],
            },
          },
          false,
          'clearObjectSyncState'
        ),

      updateConnectionQuality: (quality) =>
        set(
          (state) => ({
            connectionQuality: {
              ...state.connectionQuality,
              ...quality,
            },
          }),
          false,
          'updateConnectionQuality'
        ),

      setSyncStatus: (status) =>
        set(
          { syncStatus: status },
          false,
          'setSyncStatus'
        ),

      addPendingOperation: (operation) =>
        set(
          (state) => ({
            pendingOperations: [...state.pendingOperations, operation],
          }),
          false,
          'addPendingOperation'
        ),

      removePendingOperation: (operationId) =>
        set(
          (state) => ({
            pendingOperations: state.pendingOperations.filter(
              (op) => op.id !== operationId
            ),
          }),
          false,
          'removePendingOperation'
        ),

      markOperationCompleted: (operationId) =>
        set(
          (state) => ({
            pendingOperations: state.pendingOperations.filter(
              (op) => op.id !== operationId
            ),
          }),
          false,
          'markOperationCompleted'
        ),

      retryOperation: (operationId) =>
        set(
          (state) => ({
            pendingOperations: state.pendingOperations.map((op) =>
              op.id === operationId
                ? { ...op, retryCount: op.retryCount + 1 }
                : op
            ),
          }),
          false,
          'retryOperation'
        ),

      clearPendingOperations: () =>
        set(
          { pendingOperations: [] },
          false,
          'clearPendingOperations'
        ),

      getRetryableOperations: () => {
        const { pendingOperations } = get();
        return pendingOperations.filter((op) => op.retryCount < 3);
      },

      setLastSyncTimestamp: (timestamp) =>
        set(
          { lastSyncTimestamp: timestamp },
          false,
          'setLastSyncTimestamp'
        ),

      reset: () =>
        set(
          {
            ...initialState,
            connectedUsers: new Map<string, RoomUser>(),
            userPositions: new Map<string, Vector3>(),
          },
          false,
          'reset'
        ),
    }),
    { name: 'MultiplayerStore' }
  )
);

export default useMultiplayerStore;
