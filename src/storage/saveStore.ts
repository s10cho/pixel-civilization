import { SAVE } from '../config/gameConfig';
import type { EraId } from '../progression/era';
import type { GameState } from '../simulation/gameState';
import { migrateState, SAVE_VERSION } from './migrations';

/** What the slot picker shows without loading a whole city. */
export interface SaveSummary {
  era: EraId;
  cityLevel: number;
  population: number;
  gold: number;
  buildings: number;
}

export interface SlotInfo {
  slot: number;
  /** Epoch milliseconds. */
  savedAt: number;
  summary: SaveSummary;
}

export interface LoadedSave {
  state: GameState;
  savedAt: number;
}

interface SaveRecord extends SlotInfo {
  version: number;
  state: GameState;
}

let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(SAVE.dbName, SAVE.dbVersion);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SAVE.storeName)) {
        request.result.createObjectStore(SAVE.storeName, { keyPath: 'slot' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the save database'));
  });
  // Let a later call retry after a failure (e.g. storage blocked, then allowed).
  database.catch(() => {
    database = null;
  });
  return database;
}

/** Runs one request in a transaction and resolves once the transaction has committed. */
async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SAVE.storeName, mode);
    const request = action(transaction.objectStore(SAVE.storeName));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Save transaction aborted'));
  });
}

export function summarize(state: GameState): SaveSummary {
  return {
    era: state.era,
    cityLevel: state.cityLevel,
    population: Math.floor(state.resources.population),
    gold: Math.floor(state.resources.gold),
    buildings: state.buildings.length,
  };
}

/** One entry per slot (1..SAVE.slots); null for an empty slot. */
export async function listSlots(): Promise<(SlotInfo | null)[]> {
  const records = (await run('readonly', (store) => store.getAll())) as SaveRecord[];
  return Array.from({ length: SAVE.slots }, (_, i) => {
    const record = records.find((r) => r.slot === i + 1);
    return record ? { slot: record.slot, savedAt: record.savedAt, summary: record.summary } : null;
  });
}

export async function loadSlot(slot: number): Promise<LoadedSave | null> {
  const record = (await run('readonly', (store) => store.get(slot))) as SaveRecord | undefined;
  if (!record) return null;
  return { state: migrateState(record.version, record.state), savedAt: record.savedAt };
}

export async function saveSlot(slot: number, state: GameState, savedAt: number = Date.now()): Promise<void> {
  const record: SaveRecord = { slot, version: SAVE_VERSION, savedAt, summary: summarize(state), state };
  // IndexedDB stores a structured clone, so the live state can keep changing afterwards.
  await run('readwrite', (store) => store.put(record));
}

export async function deleteSlot(slot: number): Promise<void> {
  await run('readwrite', (store) => store.delete(slot));
}
