const STORAGE_KEY = 'civicpulse_user_id';

function generateId(): string {
  return 'user_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export function getUserId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
