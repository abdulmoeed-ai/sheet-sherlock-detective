import { useQuery } from "@tanstack/react-query";
import { listAnalysts, listPsxCompanies, readMarketPulse } from "@/lib/api/users";
import { queryKeys } from "@/lib/api/query-keys";

export function useAnalysts() {
  return useQuery({ queryKey: queryKeys.analysts, queryFn: listAnalysts });
}

export function usePsxCompanies() {
  return useQuery({ queryKey: queryKeys.psxCompanies, queryFn: listPsxCompanies });
}

export function useMarketPulse() {
  return useQuery({
    queryKey: queryKeys.marketPulse,
    queryFn: readMarketPulse,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });
}
