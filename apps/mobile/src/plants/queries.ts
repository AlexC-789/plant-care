import {
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { useSession } from '@/auth/AuthProvider';

import * as api from './api';
import type { NewPlant, PlantPatch, PlantsPage } from './api';
import type { PreparedPhoto } from './photos';

const useUserId = () => useSession().session?.user.id ?? null;

export const plantsKey = (userId: string | null) => ['plants', userId] as const;

/** The signed-in user's plants, 20 per page, newest first; each page carries its signed photo URLs. */
export function usePlants() {
  const userId = useUserId();
  return useInfiniteQuery({
    queryKey: plantsKey(userId),
    enabled: !!userId,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.fetchPlantsPage(pageParam),
    getNextPageParam: (last, _all, page) => (last.plants.length === api.PAGE_SIZE ? page + 1 : undefined),
  });
}

export const usePlant = (id: string) => useQuery({ queryKey: ['plant', id], queryFn: () => api.fetchPlant(id) });

export const useSpecies = (id: string | null | undefined) =>
  useQuery({ queryKey: ['species', id], enabled: !!id, queryFn: () => api.fetchSpecies(id!) });

/** Local matches first; Plant.id name search (`more`) only when fewer than 3 match locally. Debounce in the caller. */
export function useSpeciesSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['species-search', term],
    enabled: term.length > 0,
    queryFn: async () => {
      const local = await api.searchLocalSpecies(term);
      if (local.length >= 3 || term.length < 2) return { local, more: [] as api.SpeciesHit[] };
      const known = new Set(local.map((s) => s.scientific_name));
      const hits = await api.searchPlantNames(term).catch(() => [] as api.SpeciesHit[]);
      return { local, more: hits.filter((h) => !known.has(h.scientificName)) };
    },
  });
}

export const useLatestHealth = (plantId: string) =>
  useQuery({ queryKey: ['health', plantId], queryFn: () => api.fetchLatestHealth(plantId) });

export function useCreatePlant() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (p: NewPlant) => api.createPlant(p),
    onSuccess: (plant) => {
      queryClient.setQueryData(['plant', plant.id], plant);
      return queryClient.invalidateQueries({ queryKey: plantsKey(userId) });
    },
  });
}

export function useUpdatePlant() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PlantPatch }) => api.updatePlant(id, patch),
    onSuccess: (plant) => {
      queryClient.setQueryData(['plant', plant.id], plant);
      return queryClient.invalidateQueries({ queryKey: plantsKey(userId) });
    },
  });
}

export function useDeletePlant() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePlant(id),
    onSuccess: (_void, id) => {
      queryClient.setQueryData<InfiniteData<PlantsPage>>(plantsKey(userId), (old) =>
        old && { ...old, pages: old.pages.map((pg) => ({ ...pg, plants: pg.plants.filter((p) => p.id !== id) })) },
      );
      queryClient.removeQueries({ queryKey: ['plant', id] });
      queryClient.removeQueries({ queryKey: ['health', id] });
    },
  });
}

export const useIdentify = () => useMutation({ mutationFn: (photoPaths: string[]) => api.identifyPlant(photoPaths) });

export function useCheckHealth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ['check-health'],
    mutationFn: ({ plantId, photoPaths }: { plantId: string; photoPaths: string[] }) =>
      api.checkHealth(plantId, photoPaths),
    onSuccess: (_result, { plantId }) =>
      Promise.all([['health', plantId], plantPhotosKey(plantId)].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

/** Status of the newest health check for this plant, wherever it was started (e.g. the add flow). */
export const useHealthCheckStatus = (plantId: string) =>
  useMutationState({
    filters: { mutationKey: ['check-health'], predicate: (m) => (m.state.variables as { plantId: string }).plantId === plantId },
    select: (m) => m.state,
  }).at(-1);

export const plantPhotosKey = (plantId: string) => ['plant-photos', plantId] as const;

/** A plant's timeline, 20 per page, newest first; each page carries its signed photo URLs. */
export const usePlantPhotos = (plantId: string) =>
  useInfiniteQuery({
    queryKey: plantPhotosKey(plantId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.fetchPlantPhotos(plantId, pageParam),
    getNextPageParam: (last, _all, page) => (last.photos.length === api.PAGE_SIZE ? page + 1 : undefined),
  });

/** After a timeline change: the timeline, the plant (main photo) and the list (thumbnail) are stale. */
function useInvalidateTimeline() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return (plantId: string) =>
    Promise.all([plantPhotosKey(plantId), ['plant', plantId], plantsKey(userId)].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ));
}

export function useAddPlantPhoto() {
  const userId = useUserId();
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: ({ plantId, photo }: { plantId: string; photo: PreparedPhoto }) =>
      api.addPlantPhoto(userId!, plantId, photo),
    onSuccess: (_path, { plantId }) => invalidate(plantId),
  });
}

export function useDeletePlantPhoto() {
  const invalidate = useInvalidateTimeline();
  return useMutation({
    mutationFn: ({ plantId, photo }: { plantId: string; photo: { id: string; path: string } }) =>
      api.deletePlantPhoto(plantId, photo),
    onSuccess: (_void, { plantId }) => invalidate(plantId),
  });
}
