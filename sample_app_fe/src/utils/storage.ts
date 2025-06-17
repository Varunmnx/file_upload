export enum StorageKeys {
  /**
   * Key for storing user data.
   */
  USERDATA = "@UserData",

  /**
   * Key for storing authentication token.
   */
  TOKEN = "@Token",
  //  user authentication status
  AUTHSTATUS = "@AuthStatus",

  // refesh token for current user
  REFRESH = "@Refresh",
  /*
    fileName of files uploaded
  */
  UPLOADED_FILENAMES = "@UploadedFileNames",
  /*
    feedback names
  */
  FEEDBACK = "@FeedBack",
  /*
    feedbacks
 */
  NOTESATTACHMENT = "@NotesAttachment",

  USERAUTHDATA = "@UserAuthData",
}

/**
 * Loads a string from storage.
 *
 * @param key - The key to fetch.
 * @returns The string value stored under the specified key, or `undefined` if not found.
 */
export function loadString(key: string): string | undefined {
  try {
    const value = localStorage.getItem(key);
    if (!value) throw new Error("Value not found in storage");
    return value;
  } catch (error) {
    console.log(`Error while loading string from storage: ${error}`);
    return undefined;
  }
}

/**
 * Saves a string to storage.
 *
 * @param key - The key to store the value under.
 * @param value - The string value to store.
 */
export function saveString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.log(`Error while saving string to storage: ${error}`);
  }
}

/**
 * Loads something from storage and parses it using JSON.parse.
 *
 * @param key - The key to fetch.
 * @returns The parsed object, or `undefined` if not found or unable to parse.
 */
export function load<T>(key: string): T | undefined {
  try {
    const almostThere = localStorage.getItem(key);
    if (!almostThere) throw new Error("Value not found in storage");
    return JSON.parse(almostThere) as T;
  } catch (error) {
    console.log(`Error while loading object from storage: ${error}`);
    console.log(`Error while loading object from storage: using ${key}`);
    return undefined;
  }
}

/**
 * Saves an object to storage.
 *
 * @param key - The key to store the object under.
 * @param value - The object to store.
 */
export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.log(`Error while saving object to storage: ${error}`);
  }
}

/**
 * Removes an item from storage.
 *
 * @param key - The key of the item to remove.
 */
export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.log(`Error while removing item from storage: ${error}`);
  }
}

/**
 * Clears all items in storage.
 */
export function clear(): void {
  try {
    localStorage.clear();
  } catch (error) {
    console.log(`Error while clearing storage: ${error}`);
  }
}
