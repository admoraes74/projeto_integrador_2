import type { Specialty } from "@/lib/catalog";

const DATABASE_NAME = "construcao-provider-drafts";
const STORE_NAME = "services";

export type LocalDraftService = {
  id: string;
  title: string;
  description: string;
  specialty: Specialty;
  image: Blob;
  contentType: string;
  createdAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir os rascunhos locais."));
  });
}

export async function listLocalDraftServices(): Promise<LocalDraftService[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as LocalDraftService[]).sort((a, b) => a.createdAt - b.createdAt));
      request.onerror = () => reject(request.error ?? new Error("Não foi possível carregar as fotos locais."));
    });
  } finally { database.close(); }
}

export async function saveLocalDraftService(item: Omit<LocalDraftService, "id" | "createdAt">): Promise<LocalDraftService> {
  const database = await openDatabase();
  const saved: LocalDraftService = { ...item, id: crypto.randomUUID(), createdAt: Date.now() };
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(saved);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível salvar este serviço localmente."));
      transaction.onabort = () => reject(transaction.error ?? new Error("O salvamento local foi cancelado."));
    });
    return saved;
  } finally { database.close(); }
}

export async function removeLocalDraftService(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível remover este serviço local."));
    });
  } finally { database.close(); }
}

export async function clearLocalDraftServices(): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Não foi possível limpar as fotos locais."));
    });
  } finally { database.close(); }
}
