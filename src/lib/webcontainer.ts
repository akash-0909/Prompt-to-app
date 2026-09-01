import { WebContainer } from "@webcontainer/api";

const globalForWebContainer = globalThis as typeof globalThis & {
  webcontainerPromise?: Promise<WebContainer>;
};

export function getWebContainer(): Promise<WebContainer> {
  if (!globalForWebContainer.webcontainerPromise) {
    globalForWebContainer.webcontainerPromise = WebContainer.boot();
  }

  return globalForWebContainer.webcontainerPromise;
}          