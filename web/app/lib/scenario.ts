import { apiUrl } from "./api";

export async function runScenario(name: string): Promise<void> {
  const res = await fetch(`${apiUrl()}/scenario/${name}`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`scenario ${name} failed: ${res.status}`);
  }
}
