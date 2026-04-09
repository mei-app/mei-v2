/**
 * Manages anonymous member identity per list, stored in SecureStore.
 * Key: mei_member_{listId} → member UUID in list_members table
 */
import * as SecureStore from "expo-secure-store";

const key = (listId: string) => `mei_member_${listId}`;

export async function getMemberId(listId: string): Promise<string | null> {
  return SecureStore.getItemAsync(key(listId));
}

export async function setMemberId(listId: string, memberId: string): Promise<void> {
  return SecureStore.setItemAsync(key(listId), memberId);
}
