/**
 * Normalized container registry for runtime scalar parentId resolution.
 * Allows nested containers and items to resolve ancestor capacities without
 * storing live object references on item instances, eliminating circular JSON graphs.
 */

const containerRegistry = new Map<string, any>();

export function registerContainer(container: any): void {
  if (container?.id) {
    containerRegistry.set(container.id, container);
  }
}

export function unregisterContainer(id: string): void {
  containerRegistry.delete(id);
}

export function getRegisteredContainer<T = any>(id: string): T | null {
  return (containerRegistry.get(id) as T) ?? null;
}

export function clearContainerRegistry(): void {
  containerRegistry.clear();
}
