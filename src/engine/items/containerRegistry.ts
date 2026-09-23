import { activeContainerStore } from '../registries/containerRegistryStore';

/**
 * Normalized container registry for runtime scalar parentId resolution.
 * Allows nested containers and items to resolve ancestor capacities without
 * storing live object references on item instances, eliminating circular JSON graphs.
 *
 * Scoped per GameEngine instance via activeContainerStore() (ARCHITECTURE.md §3, §5; docs/architecture/content-extensibility.md).
 */

export function registerContainer(container: any): void {
  if (container?.id) {
    activeContainerStore().register(container.id, container);
  }
}

export function unregisterContainer(id: string): void {
  activeContainerStore().unregister(id);
}

export function getRegisteredContainer<T = any>(id: string): T | null {
  return (activeContainerStore().get(id) as T) ?? null;
}

export function clearContainerRegistry(): void {
  activeContainerStore().clear();
}

