import { useEffect, useRef, useState } from 'react';
import { casesService, type CaseDetail, type CaseListItem } from '../services/cases';

const buildPartialDetailFromListItem = (item: CaseListItem): CaseDetail => ({
  id: item.id,
  caseId: item.caseId,
  processKey: item.processKey,
  processVersion: item.processVersion,
  status: item.status,
  currentStage: item.currentStage,
  createdTime: item.createdTime,
  startedTime: item.createdTime,
  slaStatus: item.slaStatus,
  client: {
    name: item.clientName,
  },
  credit: {
    creditType: item.creditType,
    requestedAmount: item.requestedAmount,
  },
  stages: [],
  tasks: [],
  documents: [],
});

export function useCaseDetail(id: string | undefined, refreshKey?: number) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [allCases, setAllCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailRef = useRef<CaseDetail | null>(null);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;

    const load = async () => {
      const currentDetail = detailRef.current;
      const isInitialLoad = !currentDetail || currentDetail.id !== id;
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      let hasVisiblePayload = !isInitialLoad;

      const detailPromise = casesService.getCaseById(id)
        .then((detailResponse) => {
          if (isCancelled) return;
          setDetail((currentDetail) => {
            if (!currentDetail || currentDetail.id !== id || isInitialLoad) {
              return detailResponse;
            }

            return {
              ...detailResponse,
              status: currentDetail.status,
              currentStage: currentDetail.currentStage,
              createdTime: currentDetail.createdTime,
              startedTime: currentDetail.startedTime,
              slaStatus: currentDetail.slaStatus,
              client: currentDetail.client,
              credit: currentDetail.credit,
            };
          });
          hasVisiblePayload = true;
          setLoading(false);
          setRefreshing(false);
        });

      const listPromise = casesService.getCases()
        .then((listResponse) => {
          if (isCancelled) return;
          setAllCases(listResponse);

          if (!hasVisiblePayload) {
            const matchingItem = listResponse.find((item) => item.id === id);
            if (matchingItem) {
              setDetail((currentDetail) => (
                currentDetail && currentDetail.id === id
                  ? currentDetail
                  : buildPartialDetailFromListItem(matchingItem)
              ));
              hasVisiblePayload = true;
              setLoading(false);
            }
          }
        });

      const [detailResult, listResult] = await Promise.allSettled([detailPromise, listPromise]);
      if (isCancelled) return;

      const firstRejected = [detailResult, listResult].find((result) => result.status === 'rejected');
      if (firstRejected?.status === 'rejected') {
        setError(firstRejected.reason instanceof Error ? firstRejected.reason.message : 'Erreur de chargement du dossier');
      }

      setLoading(false);
      setRefreshing(false);
    };

    load();
    return () => { isCancelled = true; };
  }, [id, refreshKey]);

  return { detail, allCases, loading, refreshing, error };
}
