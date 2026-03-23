import { useEffect, useState } from 'react';
import { casesService, type CaseDetail, type CaseListItem } from '../services/cases';

export function useCaseDetail(id: string | undefined) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [allCases, setAllCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [detailResponse, listResponse] = await Promise.all([
          casesService.getCaseById(id),
          casesService.getCases(),
        ]);
        if (isCancelled) return;
        setDetail(detailResponse);
        setAllCases(listResponse);
      } catch (err) {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : 'Erreur de chargement du dossier');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    load();
    return () => { isCancelled = true; };
  }, [id]);

  return { detail, allCases, loading, error };
}
