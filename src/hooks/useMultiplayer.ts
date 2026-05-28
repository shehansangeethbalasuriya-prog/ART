import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ARObject, User, PresenceData, Vector3Data, QuaternionData } from '../types';

interface UseMultiplayerReturn {
  users: User[];
  objects: ARObject[];
  isConnected: boolean;
  addObject: (object: Omit<ARObject, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateObject: (id: string, updates: Partial<ARObject>) => Promise<void>;
  deleteObject: (id: string) => Promise<void>;
  updatePresence: (position: Vector3Data, rotation: QuaternionData) => Promise<void>;
  error: string | null;
}

const OBJECTS_COLLECTION = 'objects';
const PRESENCE_COLLECTION = 'presence';

export function useMultiplayer(roomId: string | null, userId: string | null): UseMultiplayerReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [objects, setObjects] = useState<ARObject[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unsubscribersRef = useRef<Unsubscribe[]>([]);

  const cleanup = useCallback(() => {
    unsubscribersRef.current.forEach((unsub) => unsub());
    unsubscribersRef.current = [];
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!roomId) {
      cleanup();
      setUsers([]);
      setObjects([]);
      return;
    }

    cleanup();
    setIsConnected(true);

    const objectsQuery = query(
      collection(db, OBJECTS_COLLECTION),
      where('roomId', '==', roomId)
    );

    const unsubObjects = onSnapshot(
      objectsQuery,
      (snapshot) => {
        const objectsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ARObject[];
        setObjects(objectsData);
        setError(null);
      },
      (err) => {
        console.error('Objects subscription error:', err);
        setError('Failed to sync objects');
      }
    );

    const presenceQuery = query(
      collection(db, PRESENCE_COLLECTION),
      where('roomId', '==', roomId)
    );

    const unsubPresence = onSnapshot(
      presenceQuery,
      (snapshot) => {
        const usersData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as User[];
        setUsers(usersData.filter((u) => u.isOnline));
        setError(null);
      },
      (err) => {
        console.error('Presence subscription error:', err);
        setError('Failed to sync users');
      }
    );

    unsubscribersRef.current = [unsubObjects, unsubPresence];

    return cleanup;
  }, [roomId, cleanup]);

  const addObject = useCallback(
    async (objectData: Omit<ARObject, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
      if (!roomId) {
        throw new Error('No room joined');
      }

      try {
        const docRef = await addDoc(collection(db, OBJECTS_COLLECTION), {
          ...objectData,
          roomId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setError(null);
        return docRef.id;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add object';
        setError(message);
        throw new Error(message);
      }
    },
    [roomId]
  );

  const updateObject = useCallback(
    async (id: string, updates: Partial<ARObject>): Promise<void> => {
      try {
        const objectRef = doc(db, OBJECTS_COLLECTION, id);
        await updateDoc(objectRef, {
          ...updates,
          updatedAt: serverTimestamp(),
        });
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update object';
        setError(message);
        throw new Error(message);
      }
    },
    []
  );

  const deleteObject = useCallback(async (id: string): Promise<void> => {
    try {
      const objectRef = doc(db, OBJECTS_COLLECTION, id);
      await deleteDoc(objectRef);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete object';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const updatePresence = useCallback(
    async (position: Vector3Data, rotation: QuaternionData): Promise<void> => {
      if (!roomId || !userId) {
        return;
      }

      try {
        const presenceRef = doc(db, PRESENCE_COLLECTION, userId);
        await updateDoc(presenceRef, {
          position,
          rotation,
          lastSeen: serverTimestamp(),
          isOnline: true,
        } as Partial<DocumentData>);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update presence';
        setError(message);
      }
    },
    [roomId, userId]
  );

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    users,
    objects,
    isConnected,
    addObject,
    updateObject,
    deleteObject,
    updatePresence,
    error,
  };
}

export default useMultiplayer;
