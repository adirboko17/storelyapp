import * as SecureStore from "expo-secure-store";

const CHUNK = 1800;

function countKey(key: string) {
  return `${key}.chunk-count`;
}

function partKey(key: string, index: number) {
  return `${key}.chunk.${index}`;
}

async function removeQuiet(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* a missing key is already gone */
  }
}

export async function secureGet(key: string) {
  const countRaw = await SecureStore.getItemAsync(countKey(key));
  if (countRaw) {
    const count = Number(countRaw);
    if (!Number.isInteger(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const part = await SecureStore.getItemAsync(partKey(key, index));
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join("");
  }
  return SecureStore.getItemAsync(key);
}

export async function secureRemove(key: string) {
  const countRaw = await SecureStore.getItemAsync(countKey(key));
  if (countRaw) {
    const count = Number(countRaw);
    if (Number.isInteger(count) && count > 0) {
      for (let index = 0; index < count; index += 1) await removeQuiet(partKey(key, index));
    }
    await removeQuiet(countKey(key));
  }
  await removeQuiet(key);
}

export async function secureSet(key: string, value: string) {
  await secureRemove(key);
  if (value.length <= CHUNK) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  const count = Math.ceil(value.length / CHUNK);
  await SecureStore.setItemAsync(countKey(key), String(count));
  for (let index = 0; index < count; index += 1) {
    await SecureStore.setItemAsync(partKey(key, index), value.slice(index * CHUNK, (index + 1) * CHUNK));
  }
}

export const secureStoreAdapter = {
  getItem: (key: string) => secureGet(key),
  setItem: (key: string, value: string) => secureSet(key, value),
  removeItem: (key: string) => secureRemove(key),
};
