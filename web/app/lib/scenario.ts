import { apiUrl } from "./api";

export async function runScenario(name: string): Promise<void> {
  await fetch(`${apiUrl()}/scenario/${name}`, { method: "POST" });
}
