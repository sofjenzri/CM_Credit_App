
    import React, { useEffect, useMemo, useState } from 'react';
    import { UiPath } from '@uipath/uipath-typescript/core';
    import { MaestroProcesses, ProcessInstances } from '@uipath/uipath-typescript/maestro-processes';
    import { Cases, CaseInstances } from '@uipath/uipath-typescript/cases';

    interface Folder {
      id?: string;
      name?: string;
      description?: string;
    }
    interface Process {
      id?: string;
      name?: string;
      description?: string;
    }
    interface Instance {
      id?: string;
      status?: string;
      startTime?: string;
      endTime?: string;
    }

    interface Case {
      id?: string;
      name?: string;
      processKey?: string;
      packageId?: string;
      runningCount?: number;
      status?: string;
      createdTime?: string;
      description?: string;
    }

    interface CaseInstance {
      id?: string;
      caseId?: string;
      status?: string;
      createdTime?: string;
      closedTime?: string;
    }

    const App: React.FC = () => {
      const [isAuthenticated, setIsAuthenticated] = useState(false);
      const [isLoading, setIsLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [success, setSuccess] = useState<string | null>(null);
      const [folders, setFolders] = useState<Folder[]>([]);
      const [processes, setProcesses] = useState<Process[]>([]);
      const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
      const [processInstances, setProcessInstances] = useState<Instance[]>([]);
      const [sdk, setSdk] = useState<UiPath | null>(null);
      const [cases, setCases] = useState<Case[]>([]);
      const [selectedCase, setSelectedCase] = useState<Case | null>(null);
      const [caseInstances, setCaseInstances] = useState<CaseInstance[]>([]);
      const [activeTab, setActiveTab] = useState<'folders' | 'processes' | 'instances' | 'cases' | 'caseInstances'>('folders');

  const sdkConfig = useMemo(() => {
    const clientId = import.meta.env.VITE_UIPATH_CLIENT_ID;
    const orgName = import.meta.env.VITE_UIPATH_ORG_NAME;
    const tenantName = import.meta.env.VITE_UIPATH_TENANT_NAME;
    const redirectUriRaw = import.meta.env.VITE_UIPATH_REDIRECT_URI;
    const scope = import.meta.env.VITE_UIPATH_SCOPE;

    // Use window.location.origin for local development with proxy
    const baseUrl = window.location.origin;
    const redirectUri = redirectUriRaw || window.location.origin;

    console.log('SDK Config:', { baseUrl, clientId, redirectUri, orgName, tenantName, scope });

    return {
      clientId,
      orgName,
      tenantName,
      baseUrl,
      redirectUri,
      scope,
    };
  }, []);      useEffect(() => {
        const hasOAuthParams =
          window.location.search.includes('code=') ||
          window.location.search.includes('state=') ||
          window.location.search.includes('error=');

        if (!hasOAuthParams) {
          return;
        }

        const completeOAuthCallback = async () => {
          try {
            setIsLoading(true);
            setError(null);

        const uiPathSdk = new UiPath({
          baseUrl: sdkConfig.baseUrl,
          orgName: sdkConfig.orgName,
          tenantName: sdkConfig.tenantName,
          clientId: sdkConfig.clientId,
          redirectUri: sdkConfig.redirectUri,
          scope: sdkConfig.scope,
        });

        await uiPathSdk.initialize();
            setSdk(uiPathSdk);
            await loadFolders(uiPathSdk);
            await loadProcesses(uiPathSdk);
            await loadCases(uiPathSdk);
            setSuccess('Connexion réussie à UiPath !');
            setIsAuthenticated(true);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Erreur UiPath (${errorMessage}). Vérifie Redirect URI: ${sdkConfig.redirectUri}`);
          } finally {
            setIsLoading(false);
          }
        };

        completeOAuthCallback();
      }, [sdkConfig]);

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);
      const uiPathSdk = new UiPath({
        baseUrl: sdkConfig.baseUrl,
        orgName: sdkConfig.orgName,
        tenantName: sdkConfig.tenantName,
        clientId: sdkConfig.clientId,
        redirectUri: sdkConfig.redirectUri,
        scope: sdkConfig.scope,
      });
      await uiPathSdk.initialize();
      setSdk(uiPathSdk);
      await loadFolders(uiPathSdk);
      await loadProcesses(uiPathSdk);
      await loadCases(uiPathSdk);
      setSuccess('Connexion réussie à UiPath !');
      setIsAuthenticated(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erreur lors de la connexion UiPath: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFolders = async (_uiPathSdk: UiPath) => {
    try {
      setFolders([]);
    } catch {
      setFolders([]);
    }
  };

  const loadProcesses = async (uiPathSdk: UiPath) => {
    try {
      const maestroProcesses = new MaestroProcesses(uiPathSdk);
      const result = await maestroProcesses.getAll();
      setProcesses(Array.isArray(result) ? result : []);
    } catch {
      setProcesses([]);
    }
  };

  const loadCases = async (uiPathSdk: UiPath) => {
    try {
      const casesApi = new Cases(uiPathSdk);
      const result = await casesApi.getAll();
      setCases(Array.isArray(result) ? result : []);
    } catch {
      setCases([]);
    }
  };

  const loadCaseInstances = async (caseProcessKey?: string) => {
    if (!sdk) return;
    try {
      setIsLoading(true);
      setError(null);
      const caseInstancesApi = new CaseInstances(sdk);
      const result = await caseInstancesApi.getAll(
        caseProcessKey ? { processKey: caseProcessKey } : undefined,
      );
      const rawInstances = Array.isArray(result)
        ? (result as any[])
        : Array.isArray((result as { items?: unknown[] })?.items)
          ? ((result as { items: any[] }).items)
          : [];
      const normalizedInstances: CaseInstance[] = rawInstances.map((item) => ({
        id: item.instanceId,
        caseId: item.processKey,
        status: item.latestRunStatus,
        createdTime: item.startedTime,
        closedTime: item.completedTime,
      }));
      setCaseInstances(normalizedInstances);
    } catch {
      setCaseInstances([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProcessInstances = async (_processId: string) => {
    if (!sdk) return;
    try {
      setIsLoading(true);
      setError(null);
      const processInstancesApi = new ProcessInstances(sdk);
      const result = await processInstancesApi.getAll();
      setProcessInstances(Array.isArray(result) ? result : []);
    } catch {
      setProcessInstances([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessSelect = (process: Process) => {
    setSelectedProcess(process);
    setActiveTab('instances');
    loadProcessInstances(process.id || '');
  };

  const handleCaseSelect = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setActiveTab('caseInstances');
    const caseProcessKey = caseItem.processKey || caseItem.id || caseItem.name || '';
    loadCaseInstances(caseProcessKey);
  };

      const handleLogout = () => {
        setIsAuthenticated(false);
        setError(null);
        setSuccess(null);
        setProcesses([]);
        setFolders([]);
        setSelectedProcess(null);
          setCases([]);
          setSelectedCase(null);
          setCaseInstances([]);
        setProcessInstances([]);
        setSdk(null);
        setActiveTab('folders');
      };

      return (
        <>
          {isAuthenticated ? (
            <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ background: 'white', borderRadius: '0.5rem', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>Maestro Process Manager</h1>
                    <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>Connecté à {import.meta.env.VITE_UIPATH_ORG_NAME}</p>
                  </div>
                  <button onClick={handleLogout} style={{ background: '#dc2626', color: 'white', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Déconnexion</button>
                </div>
                {success && (<div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '0.375rem', padding: '1rem', marginBottom: '1rem' }}><p style={{ color: '#047857', margin: 0 }}>✓ {success}</p></div>)}
                {error && (<div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.375rem', padding: '1rem', marginBottom: '1rem' }}><p style={{ margin: 0 }}><strong>Erreur :</strong> {error}</p></div>)}
                <div style={{ background: 'white', borderRadius: '0.5rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                    <button onClick={() => setActiveTab('folders')} style={{ flex: 1, padding: '1rem', background: activeTab === 'folders' ? '#dbeafe' : 'white', borderBottom: activeTab === 'folders' ? '3px solid #2563eb' : 'none', color: activeTab === 'folders' ? '#2563eb' : '#6b7280', fontWeight: activeTab === 'folders' ? '600' : '500', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>📁 Dossiers UiPath ({folders.length})</button>
                    <button onClick={() => setActiveTab('processes')} style={{ flex: 1, padding: '1rem', background: activeTab === 'processes' ? '#dbeafe' : 'white', borderBottom: activeTab === 'processes' ? '3px solid #2563eb' : 'none', color: activeTab === 'processes' ? '#2563eb' : '#6b7280', fontWeight: activeTab === 'processes' ? '600' : '500', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>⚙️ Processus Maestro ({processes.length})</button>
                                        <button onClick={() => setActiveTab('cases')} style={{ flex: 1, padding: '1rem', background: activeTab === 'cases' ? '#dbeafe' : 'white', borderBottom: activeTab === 'cases' ? '3px solid #2563eb' : 'none', color: activeTab === 'cases' ? '#2563eb' : '#6b7280', fontWeight: activeTab === 'cases' ? '600' : '500', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>📋 Cases ({cases.length})</button>
                    {selectedProcess && (<button onClick={() => setActiveTab('instances')} style={{ flex: 1, padding: '1rem', background: activeTab === 'instances' ? '#dbeafe' : 'white', borderBottom: activeTab === 'instances' ? '3px solid #2563eb' : 'none', color: activeTab === 'instances' ? '#2563eb' : '#6b7280', fontWeight: activeTab === 'instances' ? '600' : '500', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>📊 Instances ({processInstances.length})</button>)}
                                      {selectedCase && (<button onClick={() => setActiveTab('caseInstances')} style={{ flex: 1, padding: '1rem', background: activeTab === 'caseInstances' ? '#dbeafe' : 'white', borderBottom: activeTab === 'caseInstances' ? '3px solid #2563eb' : 'none', color: activeTab === 'caseInstances' ? '#2563eb' : '#6b7280', fontWeight: activeTab === 'caseInstances' ? '600' : '500', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>📑 Case Instances ({caseInstances.length})</button>)}
                  </div>
                  <div style={{ padding: '2rem' }}>
                    {activeTab === 'folders' && (<div><h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>📁 Dossiers UiPath</h2>{folders.length === 0 ? (<div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '0.375rem', padding: '2rem', textAlign: 'center', color: '#1e40af' }}><p style={{ margin: 0 }}>Aucun dossier trouvé ou connexion sans authentification</p></div>) : (<div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>ID</th><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Nom</th><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Description</th></tr></thead><tbody>{folders.map((folder, idx) => (<tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '0.75rem', color: '#1f2937', fontSize: '0.875rem', fontFamily: 'monospace' }}>{folder.id?.toString().substring(0, 8) || 'N/A'}</td><td style={{ padding: '0.75rem', color: '#1f2937', fontSize: '0.875rem', fontWeight: '600' }}>{folder.name || 'N/A'}</td><td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>{folder.description || '-'}</td></tr>))}</tbody></table></div>)}</div>)}
                    {activeTab === 'processes' && (<div><h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>⚙️ Processus Maestro</h2>{processes.length === 0 ? (<div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '0.375rem', padding: '2rem', textAlign: 'center', color: '#1e40af' }}><p style={{ margin: 0 }}>Aucun processus Maestro trouvé</p></div>) : (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>{processes.map((process, idx) => (<div key={idx} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.1)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; }}><h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.5rem 0' }}>{process.name || 'Sans nom'}</h3><p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>{process.description || 'Pas de description'}</p><button onClick={e => { e.stopPropagation(); handleProcessSelect(process); }} style={{ width: '100%', background: '#2563eb', color: 'white', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Voir les instances</button></div>))}</div>)}</div>)}
                                        {activeTab === 'cases' && (<div><h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>📋 Cases</h2>{cases.length === 0 ? (<div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '0.375rem', padding: '2rem', textAlign: 'center', color: '#1e40af' }}><p style={{ margin: 0 }}>Aucune case trouvée</p></div>) : (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>{cases.map((caseItem, idx) => (<div key={idx} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.375rem', padding: '1rem', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }} onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.1)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; }}><h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1f2937', margin: '0 0 0.5rem 0' }}>{caseItem.name || 'Sans nom'}</h3><p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>{caseItem.description || 'Pas de description'}</p><button onClick={e => { e.stopPropagation(); handleCaseSelect(caseItem); }} style={{ width: '100%', background: '#2563eb', color: 'white', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Voir les instances</button></div>))}</div>)}</div>)}
                    {activeTab === 'instances' && selectedProcess && (<div><div style={{ marginBottom: '1.5rem' }}><button onClick={() => setActiveTab('processes')} style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', padding: 0 }}>← Retour aux processus</button></div><h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>📊 Instances - {selectedProcess.name}</h2>{isLoading ? (<div style={{ textAlign: 'center', padding: '2rem' }}><div style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid #e5e7eb', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>) : processInstances.length === 0 ? (<div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '0.375rem', padding: '2rem', textAlign: 'center', color: '#1e40af' }}><p style={{ margin: 0 }}>Aucune instance trouvée pour ce processus</p></div>) : (<div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>ID</th><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Statut</th><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Début</th><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Fin</th></tr></thead><tbody>{processInstances.map((instance, idx) => (<tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '0.75rem', color: '#1f2937', fontSize: '0.875rem' }}>{instance.id?.toString().substring(0, 12) || 'N/A'}</td><td style={{ padding: '0.75rem', fontSize: '0.875rem' }}><span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', background: instance.status === 'Success' ? '#dcfce7' : instance.status === 'Failed' ? '#fee2e2' : '#fef3c7', color: instance.status === 'Success' ? '#166534' : instance.status === 'Failed' ? '#991b1b' : '#92400e', fontSize: '0.75rem', fontWeight: '600' }}>{instance.status || 'UNKNOWN'}</span></td><td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>{instance.startTime ? new Date(instance.startTime).toLocaleString('fr-FR') : '-'}</td><td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>{instance.endTime ? new Date(instance.endTime).toLocaleString('fr-FR') : '-'}</td></tr>))}</tbody></table></div>)}</div>)}
                                      {activeTab === 'caseInstances' && selectedCase && (<div><div style={{ marginBottom: '1.5rem' }}><button onClick={() => setActiveTab('cases')} style={{ background: 'transparent', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', padding: 0 }}>← Retour aux cases</button></div><h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>📑 Case Instances - {selectedCase.name}</h2>{isLoading ? (<div style={{ textAlign: 'center', padding: '2rem' }}><div style={{ display: 'inline-block', width: '2rem', height: '2rem', border: '3px solid #e5e7eb', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>) : caseInstances.length === 0 ? (<div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '0.375rem', padding: '2rem', textAlign: 'center', color: '#1e40af' }}><p style={{ margin: 0 }}>Aucune instance trouvée pour cette case</p></div>) : (<div style={{ border: '1px solid #e5e7eb', borderRadius: '0.375rem', overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>ID</th><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Statut</th><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Créé</th><th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>Fermé</th></tr></thead><tbody>{caseInstances.map((instance, idx) => (<tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '0.75rem', color: '#1f2937', fontSize: '0.875rem' }}>{instance.id?.toString().substring(0, 12) || 'N/A'}</td><td style={{ padding: '0.75rem', fontSize: '0.875rem' }}><span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', background: instance.status === 'Closed' ? '#dcfce7' : instance.status === 'Failed' ? '#fee2e2' : '#fef3c7', color: instance.status === 'Closed' ? '#166534' : instance.status === 'Failed' ? '#991b1b' : '#92400e', fontSize: '0.75rem', fontWeight: '600' }}>{instance.status || 'OPEN'}</span></td><td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>{instance.createdTime ? new Date(instance.createdTime).toLocaleString('fr-FR') : '-'}</td><td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.875rem' }}>{instance.closedTime ? new Date(instance.closedTime).toLocaleString('fr-FR') : '-'}</td></tr>))}</tbody></table></div>)}</div>)}
                  </div>
                </div>
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, rgb(239, 246, 255), rgb(224, 231, 255))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
              <div style={{ background: 'white', borderRadius: '1rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '2rem', maxWidth: '28rem', width: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827', margin: '0 0 0.5rem 0' }}>Maestro Process Manager</h1>
                  <p style={{ color: '#4b5563', margin: 0 }}>Gestion des processus UiPath Maestro</p>
                </div>
                {error && (<div style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.375rem', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}><strong>Erreur :</strong> {error}</div>)}
                <button onClick={handleLogin} disabled={isLoading} style={{ width: '100%', background: '#2563eb', color: 'white', fontWeight: '600', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1, fontSize: '1rem', transition: 'background-color 0.2s' }} onMouseEnter={e => !isLoading && (e.currentTarget.style.background = '#1d4ed8')} onMouseLeave={e => !isLoading && (e.currentTarget.style.background = '#2563eb')}>{isLoading ? 'Connexion en cours...' : 'Se connecter à UiPath'}</button>
                <div style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#6b7280', textAlign: 'center' }}>
                  <p style={{ margin: 0 }}>Connexion à : {import.meta.env.VITE_UIPATH_ORG_NAME}</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>{import.meta.env.VITE_UIPATH_BASE_URL}</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>Redirect URI: {sdkConfig.redirectUri}</p>
                </div>
              </div>
            </div>
          )}
        </>
      );
    };

    export default App;
