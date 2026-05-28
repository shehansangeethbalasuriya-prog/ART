import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDocs,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ARObject } from '../types';

interface ObjectUpdate {
  objectId: string;
  type: 'create' | 'update' | 'delete';
  changes?: Partial<Omit<ARObject, 'id' | 'createdAt'>>;
  data?: Omit<ARObject, 'id' | 'createdAt' | 'updatedAt'>;
}

const OBJECTS_SUBCOLLECTION = 'objects';

function getObjectsCollection(roomId: string) {
  return collection(db, 'rooms', roomId, OBJECTS_SUBCOLLECTION);
}

function getObjectDoc(roomId: string, objectId: string) {
  return doc(db, 'rooms', roomId, OBJECTS_SUBCOLLECTION, objectId);
}

export async function createObject(
  roomId: string,
  objectData: Omit<ARObject, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ARObject> {
  const objectId = doc(getObjectsCollection(roomId)).id;

  const newObject: ARObject = {
    id: objectId,
    ...objectData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(getObjectDoc(roomId, objectId), {
    ...newObject,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return newObject;
}

export async function updateObject(
  roomId: string,
  objectId: string,
  updates: Partial<Omit<ARObject, 'id' | 'createdAt'>>
): Promise<void> {
  const objectRef = getObjectDoc(roomId, objectId);

  await updateDoc(objectRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteObject(
  roomId: string,
  objectId: string
): Promise<void> {
  await deleteDoc(getObjectDoc(roomId, objectId));
}

export async function getRoomObjects(roomId: string): Promise<ARObject[]> {
  const q = query(getObjectsCollection(roomId), orderBy('createdAt', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
      updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    } as ARObject;
  });
}

export function subscribeToObjects(
  roomId: string,
  callback: (objects: ARObject[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(getObjectsCollection(roomId), orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const objects = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
          updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
        } as ARObject;
      });
      callback(objects);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function batchUpdateObjects(
  roomId: string,
  updates: ObjectUpdate[]
): Promise<void> {
  if (updates.length === 0) return;

  const batch = writeBatch(db);

  for (const update of updates) {
    const objectRef = getObjectDoc(roomId, update.objectId);

    if (update.type === 'delete') {
      batch.delete(objectRef);
    } else if (update.type === 'update') {
      batch.update(objectRef, {
        ...update.changes,
        updatedAt: serverTimestamp(),
      });
    } else if (update.type === 'create') {
      batch.set(objectRef, {
        ...update.data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

export async function batchCreateObjects(
  roomId: string,
  objects: Array<Omit<ARObject, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ARObject[]> {
  const batch = writeBatch(db);
  const created: ARObject[] = [];

  for (const objectData of objects) {
    const objectId = doc(getObjectsCollection(roomId)).id;
    const newObject: ARObject = {
      id: objectId,
      ...objectData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    batch.set(getObjectDoc(roomId, objectId), {
      ...newObject,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    created.push(newObject);
  }

  await batch.commit();
  return created;
}

export async function batchDeleteObjects(
  roomId: string,
  objectIds: string[]
): Promise<void> {
  if (objectIds.length === 0) return;

  const batch = writeBatch(db);
  for (const objectId of objectIds) {
    batch.delete(getObjectDoc(roomId, objectId));
  }
  await batch.commit();
}
