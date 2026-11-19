import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/auth/AuthProvider';
import { plantsKey } from '@/plants/queries';

import * as api from './api';

export const deviceKey = (plantId: string) => ['device', plantId] as const;

export const useDevice = (plantId: string, pollMs?: number) =>
  useQuery({ queryKey: deviceKey(plantId), queryFn: () => api.fetchDevice(plantId), refetchInterval: pollMs });

export const useCreateClaim = (plantId: string) => useMutation({ mutationFn: () => api.createClaim(plantId) });

function useDeviceMutation(plantId: string, fn: (deviceId: string) => Promise<void>) {
  const userId = useSession().session?.user.id ?? null;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([deviceKey(plantId), plantsKey(userId)].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useResumeWatering = (plantId: string) => useDeviceMutation(plantId, api.resumeWatering);
export const useRemoveDevice = (plantId: string) => useDeviceMutation(plantId, api.removeDevice);
