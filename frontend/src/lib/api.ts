export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}
