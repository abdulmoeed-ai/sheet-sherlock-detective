import { useQuery } from "@tanstack/react-query";
import { listAnalysts, listPsxCompanies } from "@/lib/api/users";
import { queryKeys } from "@/lib/api/query-keys";

export function useAnalysts() {
  return useQuery({ queryKey: queryKeys.analysts, queryFn: listAnalysts });
}

export function usePsxCompanies() {
  return useQuery({ queryKey: queryKeys.psxCompanies, queryFn: listPsxCompanies });
}
