/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export function keyByIntoMap<T, U>(
  iteratee: (obj: T) => U,
): (arr: T[]) => Map<U, T>;
export function keyByIntoMap<T, U>(
  arr: T[],
  iteratee: (obj: T) => U,
): Map<U, T>;
export function keyByIntoMap<T, U>(
  arrOrIteratee: T[] | ((obj: T) => U),
  iteratee?: (obj: T) => any,
) {
  if (!iteratee) {
    return (arr: T[]) => keyByIntoMap(arr, arrOrIteratee as any);
  }
  const arr = arrOrIteratee as T[];
  const result = new Map<U, T>();
  for (const obj of arr) {
    const key = iteratee(obj);
    result.set(key, obj);
  }
  return result;
}

// Maps allow for any type of key, not just strings/numbers/symbols
export function groupByIntoMap<T, U>(
  iteratee: (obj: T) => U,
): (arr: T[]) => Map<U, T[]>;
export function groupByIntoMap<T, U>(
  arr: T[],
  iteratee: (obj: T) => U,
): Map<U, T[]>;
export function groupByIntoMap<T, U>(
  arrOrIteratee: T[] | ((obj: T) => U),
  iteratee?: (obj: T) => any,
) {
  if (!iteratee) {
    return (arr: T[]) => groupByIntoMap(arr, arrOrIteratee as any);
  }
  const arr = arrOrIteratee as T[];
  const result = new Map<U, T[]>();
  for (const obj of arr) {
    const key = iteratee(obj);
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key)!.push(obj);
  }
  return result;
}
