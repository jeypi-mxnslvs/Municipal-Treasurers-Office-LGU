import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Property, TaxYearRecord, User, OfficialReceipt, DashboardStatsData, TaxSummary } from './types';
import { api } from './services/api';
import Header from './components/Header';
import { LoginPage, UserManagementModal, PasswordConfirmationModal } from '@/features/auth';
import { DashboardStats } from '@/features/dashboard';
import { DashboardTable, PropertyCard, RptarModal, BulkImportModal } from '@/features/properties';
import { DelinquencyTable } from '@/features/assessment';
import { OfficialReceiptModal, BookletManagerModal } from '@/features/collections';
import { AuditLogModal } from '@/features/audit';
import { NoticeOfDelinquencyModal, BlgfForm3Modal } from '@/features/reports';
import { Printer, ArrowLeft, CheckCircle2, ShieldCheck, CheckCircle, RefreshCw, Bell, FileText } from 'lucide-react';
import { verifySessionToken, DEFAULT_SESSION_TIMEOUT_MS } from './lib/crypto';

const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('lgu_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);

  const [view, setView] = useState<'dashboard' | 'posting'>('dashboard');
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [, setIsLoading] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<Property | null>(null);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isBookletModalOpen, setIsBookletModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditTargetProperty, setAuditTargetProperty] = useState<Property | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [propertyPendingDeletion, setPropertyPendingDeletion] = useState<string | null>(null);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [isBlgfModalOpen, setIsBlgfModalOpen] = useState(false);
  const [noticeProperties, setNoticeProperties] = useState<Property[]>([]);

  // Live Multi-Assessor Sync State & Notification Toast
  const [syncToast, setSyncToast] = useState<{ message: string; author: string } | null>(null);

  // Clearance & Assessment View State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [taxRecords, setTaxRecords] = useState<TaxYearRecord[]>([]);
  const [completedTaxRecords, setCompletedTaxRecords] = useState<TaxYearRecord[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | undefined>(undefined);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  
  // Sequential Selection State
  const [selectedRecords, setSelectedRecords] = useState<TaxYearRecord[]>([]);
  const [selectedScopeSubtotal, setSelectedScopeSubtotal] = useState<number>(0);
  const [isProcessingClearance, setIsProcessingClearance] = useState(false);

  // Clearance Slip Modal State
  const [issuedReceipt, setIssuedReceipt] = useState<OfficialReceipt | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Load properties and dashboard stats from API
  const loadData = useCallback(async (silent = false) => {
    if (!currentUser) return;
    if (!silent) setIsLoading(true);
    try {
      const [propsData, statsData] = await Promise.all([
        api.getProperties(),
        api.getDashboardStats()
      ]);
      setProperties(propsData);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData]);

  // Live Multi-Assessor Background Synchronization via Realtime WebSockets
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = api.subscribeToMutations((mutation) => {
      loadData(true);
      setSyncToast({
        message: `RPTAR record (${mutation.tdNumber || 'Masterlist'}) was updated [${mutation.action}]`,
        author: mutation.author,
      });

      setTimeout(() => setSyncToast(null), 5000);
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, loadData]);

  const initialRestoredRef = useRef(false);

  const handlePostPaymentView = useCallback(async (property: Property) => {
    setSelectedProperty(property);
    setIsLoading(true);
    setView('posting');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'posting');
      url.searchParams.set('td', property.tdNumber);
      window.history.replaceState({}, '', url.toString());
      localStorage.setItem('lgu_active_td', property.tdNumber);
      localStorage.setItem('lgu_active_view', 'posting');
    } catch {
      // Non-blocking URL update
    }

    try {
      const [result, completed] = await Promise.all([
        api.getPropertyAssessment(property.id, property),
        api.getPropertyCompletedRecords(property.id, property)
      ]);
      setTaxRecords(result.records);
      setCompletedTaxRecords(completed);
      setSelectedRecords(result.records);
      setTaxSummary(result.summary);
      setGrandTotal(result.grandTotal);
      setSelectedScopeSubtotal(result.grandTotal);
    } catch (err) {
      console.error('Assessment load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleBackToDashboard = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      url.searchParams.delete('td');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      localStorage.removeItem('lgu_active_td');
      localStorage.removeItem('lgu_active_view');
    } catch {
      // Non-blocking
    }
    setSelectedProperty(null);
    setView('dashboard');
    loadData();
  }, [loadData]);

  // Restore Statement of Account on page reload / refresh if previously viewing a property
  useEffect(() => {
    if (!currentUser || properties.length === 0 || initialRestoredRef.current) return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const savedTd = searchParams.get('td') || localStorage.getItem('lgu_active_td');
      const savedView = searchParams.get('view') || localStorage.getItem('lgu_active_view');

      if (savedTd && (savedView === 'posting' || savedView === 'soa')) {
        const targetProperty = properties.find(
          (p) => p.tdNumber === savedTd || String(p.id) === savedTd
        );
        if (targetProperty) {
          initialRestoredRef.current = true;
          handlePostPaymentView(targetProperty);
        }
      }
    } catch {
      // Non-blocking
    }
  }, [currentUser, properties, handlePostPaymentView]);

  const handleOpenAddModal = () => {
    setModalInitialData(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (property: Property) => {
    setModalInitialData(property);
    setIsModalOpen(true);
  };

  const handleOpenAuditModal = (property: Property | null) => {
    setAuditTargetProperty(property);
    setIsAuditModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setPropertyPendingDeletion(id);
  };

  const confirmDeleteProperty = async () => {
    if (!propertyPendingDeletion) return;
    await api.deleteProperty(propertyPendingDeletion);
    setPropertyPendingDeletion(null);
    await loadData();
  };

  const handleSaveProperty = async (data: Partial<Property>) => {
    try {
      const payload = {
        ...data,
        assessorName: currentUser?.name || 'Juan Reyes',
        stationId: currentUser?.stationId || 'Assessor-Desk-02'
      };

      await api.saveProperty(payload);
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save property:', err);
      const errMsg = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err)
          ? String((err as Record<string, unknown>).message)
          : 'Failed to save property. Please check required fields.';
      alert(errMsg);
    }
  };

  const handleSelectionChange = (selected: TaxYearRecord[], subtotal: number) => {
    setSelectedRecords(selected);
    setSelectedScopeSubtotal(subtotal);
  };

  const handleMarkDuesCleared = async () => {
    if (!selectedProperty || selectedRecords.length === 0 || !currentUser) return;

    setIsProcessingClearance(true);
    try {
      const clearanceSlip = await api.postPayment({
        propertyId: selectedProperty.id,
        paidRecords: selectedRecords,
        tenderType: 'CASH',
        postedBy: `${currentUser.name} (${currentUser.role} • ${currentUser.stationId})`,
        stationId: currentUser.stationId,
        userId: typeof currentUser.id === 'number' ? currentUser.id : parseInt(String(currentUser.id || 0), 10)
      });

      setIssuedReceipt(clearanceSlip);
      setIsReceiptModalOpen(true);

      const [updatedResult, updatedCompleted] = await Promise.all([
        api.getPropertyAssessment(selectedProperty.id, selectedProperty),
        api.getPropertyCompletedRecords(selectedProperty.id, selectedProperty)
      ]);
      setTaxRecords(updatedResult.records);
      setCompletedTaxRecords(updatedCompleted);
      setSelectedRecords(updatedResult.records);
      setGrandTotal(updatedResult.grandTotal);
      setSelectedScopeSubtotal(updatedResult.grandTotal);

      // Keep selectedProperty updated with newest clearance
      if (selectedRecords.length > 0) {
        const lastRecord = selectedRecords[selectedRecords.length - 1];
        const isPartialFirstHalf = lastRecord.quarterSpan === '1-2Q';
        const latestClearedYear = isPartialFirstHalf ? (lastRecord.year - 1) : (lastRecord.endYear || lastRecord.year);
        setSelectedProperty((prev) => prev ? {
          ...prev,
          lastPaidYear: Math.max(prev.lastPaidYear, latestClearedYear)
        } : null);
      }

      await loadData(true);
    } catch (err) {
      alert(`Clearance failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessingClearance(false);
    }
  };

  const handleLogout = useCallback((reason?: unknown) => {
    localStorage.removeItem('lgu_user');
    localStorage.removeItem('lgu_token');
    localStorage.removeItem('lgu_active_td');
    localStorage.removeItem('lgu_active_view');
    setCurrentUser(null);
    setView('dashboard');
    if (typeof reason === 'string' && reason.trim()) {
      setSessionWarning(reason);
    } else {
      setSessionWarning(null);
    }
  }, []);

  // 1. Initial boot session verification
  useEffect(() => {
    const token = localStorage.getItem('lgu_token');
    if (token) {
      verifySessionToken(token).then((payload) => {
        if (!payload) {
          handleLogout('Your session has expired. Please sign in again.');
        }
      });
    } else if (currentUser) {
      handleLogout('No active session token found. Please sign in again.');
    }
  }, [currentUser, handleLogout]);

  // 2. 15-Minute Inactivity Auto-Logout Timer (Terminal Protection)
  useEffect(() => {
    if (!currentUser) return;

    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLogout('Workstation auto-locked after 15 minutes of inactivity for security.');
      }, DEFAULT_SESSION_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [currentUser, handleLogout]);

  if (!currentUser) {
    return (
      <LoginPage 
        onLoginSuccess={(user) => {
          setSessionWarning(null);
          setCurrentUser(user);
        }} 
        sessionWarning={sessionWarning} 
      />
    );
  }

  const canClearDues = currentUser.role === 'Assessor' || currentUser.role === 'Admin' || currentUser.role === 'Cashier';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/80 text-slate-800 font-sans">
      <Header 
        user={currentUser} 
        onLogout={() => handleLogout()}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        onOpenBooklets={() => setIsBookletModalOpen(true)}
        onOpenBlgfForm3={() => setIsBlgfModalOpen(true)}
        onOpenBatchNotices={() => {
          const delinquents = properties.filter(p => p.lastPaidYear < 2026 && !p.isShellRecord);
          setNoticeProperties(delinquents);
          setIsNoticeModalOpen(true);
        }}
      />

      {/* Live Sync Toast Notification */}
      {syncToast && (
        <div className="fixed bottom-5 right-5 z-[100] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in-up max-w-md text-xs">
          <div className="p-2 bg-emerald-600 rounded-xl animate-pulse">
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-100">{syncToast.message}</p>
            <p className="text-[11px] text-slate-400">By: {syncToast.author}</p>
          </div>
          <button 
            onClick={() => setSyncToast(null)}
            className="ml-auto text-slate-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}

      <main className="flex-grow container mx-auto px-4 py-6 max-w-7xl">
        {view === 'dashboard' ? (
          <div>
            {/* Dashboard KPI Summary */}
            <DashboardStats stats={stats} />

            {/* Masterlist Table */}
            <DashboardTable 
              properties={properties} 
              currentUser={currentUser}
              onSelectProperty={handlePostPaymentView}
              onAddProperty={handleOpenAddModal}
              onEditProperty={handleOpenEditModal}
              onDeleteProperty={handleDelete}
              onViewAudit={handleOpenAuditModal}
              onOpenBulkModal={() => setIsBulkModalOpen(true)}
            />
          </div>
        ) : (
          /* Assessment & Clearance View */
          <div className="space-y-6">
            {/* Navigation Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm no-print">
              <button 
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                Back to Masterlist Dashboard
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleOpenAuditModal(selectedProperty)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 rounded-xl transition-all"
                >
                  <RefreshCw size={14} className="text-emerald-700" />
                  View Revision Trail
                </button>

                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  <Printer size={15} />
                  Print Statement of Account (SOA)
                </button>

                <button 
                  onClick={() => {
                    setNoticeProperties(selectedProperty ? [selectedProperty] : []);
                    setIsNoticeModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                  title="Generate Official Notice of Delinquency under RA 7160 Sec. 254"
                >
                  <FileText size={15} />
                  Notice of Delinquency (Sec. 254)
                </button>
              </div>
            </div>

            {selectedProperty && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Column 1: Property Master Card & Sequential Dues Clearance Action Box (Sticky on Desktop) */}
                <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6 self-start">
                  <PropertyCard 
                    property={selectedProperty} 
                    onViewAudit={() => handleOpenAuditModal(selectedProperty)}
                  />

                  {/* Sequential Dues Clearance Action Box */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 no-print">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                      <ShieldCheck size={18} className="text-emerald-600" />
                      <h3 className="font-bold text-sm text-slate-800">Sequential Dues Clearance</h3>
                    </div>

                    {taxRecords.length > 0 ? (
                      <div className="space-y-4 text-xs">
                        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                          <p className="font-bold">
                            Selected Scope: {selectedRecords.length} of {taxRecords.length} {taxRecords.length === 1 ? 'Tax Period' : 'Tax Periods'}
                          </p>
                          <p className="text-[11px] text-emerald-800">
                            Under the <strong>Arrears-First rule</strong>, earlier tax periods must be settled chronologically before subsequent ones.
                          </p>
                        </div>

                        <div className="pt-2">
                          {canClearDues ? (
                            <button 
                              onClick={handleMarkDuesCleared}
                              disabled={isProcessingClearance || selectedRecords.length === 0}
                              className={`w-full transition-all duration-200 rounded-xl shadow-md active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 bg-[#064e3b] hover:bg-[#085a44] text-white ${
                                selectedScopeSubtotal >= 100000 
                                  ? 'px-3 py-2.5 sm:py-3' 
                                  : 'px-4 py-3 sm:py-3.5'
                              }`}
                            >
                              <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
                              <div className={`flex items-center justify-center gap-1.5 text-center ${
                                selectedScopeSubtotal >= 100000 ? 'flex-col sm:flex-row' : 'flex-wrap'
                              }`}>
                                <span className="font-bold text-xs sm:text-sm">
                                  {isProcessingClearance ? 'Processing Clearance...' : 'Mark Selected Dues as Cleared'}
                                </span>
                                {!isProcessingClearance && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 font-extrabold text-xs sm:text-sm tracking-tight tabular-nums whitespace-nowrap">
                                    ₱{selectedScopeSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            </button>
                          ) : (
                            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-center text-xs">
                              Log in as <strong>Assessor</strong> or <strong>Admin</strong> to mark dues as cleared.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2">
                        <CheckCircle size={18} className="text-emerald-600" />
                        Account is fully cleared. Zero liabilities.
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2-3: Statement of Account Table */}
                <div className="lg:col-span-2">
                  <DelinquencyTable 
                    records={taxRecords} 
                    completedRecords={completedTaxRecords}
                    summary={taxSummary} 
                    grandTotal={grandTotal}
                    canEdit={currentUser?.role === 'Assessor' || currentUser?.role === 'Admin'}
                    property={selectedProperty}
                    currentUser={currentUser}
                    onSelectionChange={handleSelectionChange}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* RPTAR Property Form Modal */}
      <RptarModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProperty}
        initialData={modalInitialData}
      />

      {/* Clearance Certificate Modal (Official receipt format) */}
      <OfficialReceiptModal 
        isOpen={isReceiptModalOpen}
        receipt={issuedReceipt}
        currentUser={currentUser}
        onReceiptVoided={async () => {
          await loadData(true);
        }}
        onStayOnProperty={() => {
          setIsReceiptModalOpen(false);
          setIssuedReceipt(null);
        }}
        onReturnToDashboard={() => {
          setIsReceiptModalOpen(false);
          setIssuedReceipt(null);
          handleBackToDashboard();
        }}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setIssuedReceipt(null);
        }}
      />

      {/* AF-51 Booklet Register Modal */}
      <BookletManagerModal
        isOpen={isBookletModalOpen}
        onClose={() => setIsBookletModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Admin User Management Modal */}
      <UserManagementModal
        isOpen={isUserManagementModalOpen}
        onClose={() => setIsUserManagementModalOpen(false)}
        currentUser={currentUser}
      />

      {/* RPTAR Audit Trail Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => { setIsAuditModalOpen(false); setAuditTargetProperty(null); }}
        property={auditTargetProperty}
      />

      {/* Bulk CSV Masterlist Importer & Exporter Modal */}
      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onImportComplete={() => loadData()}
        properties={properties}
        currentUser={currentUser}
      />

      {/* Destructive Action Password Re-authentication Modal */}
      <PasswordConfirmationModal
        isOpen={Boolean(propertyPendingDeletion)}
        title="Authorize Property Deletion"
        description="Deleting a real property assessment record permanently removes it from the RPTAR masterlist and affects historical ledger records. Please confirm your password to proceed."
        username={currentUser?.username || 'admin'}
        destructiveActionLabel="Permanently Delete Record"
        onConfirm={confirmDeleteProperty}
        onClose={() => setPropertyPendingDeletion(null)}
      />

      {/* Notice of Delinquency Demand Modal (RA 7160 Sec. 254) */}
      <NoticeOfDelinquencyModal
        isOpen={isNoticeModalOpen}
        onClose={() => {
          setIsNoticeModalOpen(false);
          setNoticeProperties([]);
        }}
        properties={noticeProperties.length > 0 ? noticeProperties : (selectedProperty ? [selectedProperty] : [])}
      />

      {/* BLGF Form 3 Consolidated Monthly Report Modal */}
      <BlgfForm3Modal
        isOpen={isBlgfModalOpen}
        onClose={() => setIsBlgfModalOpen(false)}
        properties={properties}
        stats={stats}
      />
    </div>
  );
};

export default App;