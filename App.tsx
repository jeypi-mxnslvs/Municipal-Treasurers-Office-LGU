import React, { useState, useEffect, useRef } from 'react';
import { Property, TaxYearRecord, User, OfficialReceipt, DashboardStatsData, TaxSummary } from './types';
import { api } from './services/api';
import Header from './components/Header';
import LoginPage from './components/LoginPage';
import DashboardStats from './components/DashboardStats';
import DashboardTable from './components/DashboardTable';
import RptarModal from './components/RptarModal';
import PropertyCard from './components/PropertyCard';
import DelinquencyTable from './components/DelinquencyTable';
import OfficialReceiptModal from './components/OfficialReceiptModal';
import UserManagementModal from './components/UserManagementModal';
import AuditLogModal from './components/AuditLogModal';
import BulkImportModal from './components/BulkImportModal';
import { Printer, ArrowLeft, CheckCircle2, ShieldCheck, CheckCircle, Sparkles, RefreshCw, Bell } from 'lucide-react';

const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('lgu_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = useState<'dashboard' | 'posting'>('dashboard');
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<Property | null>(null);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditTargetProperty, setAuditTargetProperty] = useState<Property | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Live Multi-Assessor Sync State & Notification Toast
  const [syncToast, setSyncToast] = useState<{ message: string; author: string } | null>(null);
  const lastMutationTimeRef = useRef<string | null>(null);

  // Clearance & Assessment View State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [taxRecords, setTaxRecords] = useState<TaxYearRecord[]>([]);
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
  const loadData = async (silent = false) => {
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
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Live Multi-Assessor Background Synchronization
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(async () => {
      try {
        const sync = await api.getSyncStatus();
        if (sync && sync.latestMutation) {
          const { timestamp, author, action, tdNumber } = sync.latestMutation;
          
          if (lastMutationTimeRef.current && lastMutationTimeRef.current !== timestamp) {
            // Live update happened from another counter/session!
            loadData(true);
            setSyncToast({
              message: `RPTAR record (${tdNumber || 'Masterlist'}) was updated [${action}]`,
              author
            });

            setTimeout(() => setSyncToast(null), 5000);
          }

          lastMutationTimeRef.current = timestamp;
        }
      } catch (err) {
        // Ignore polling errors
      }
    }, 7000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const handlePostPaymentView = async (property: Property) => {
    setSelectedProperty(property);
    setIsLoading(true);
    setView('posting');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const result = await api.getPropertyAssessment(property.id, property);
      setTaxRecords(result.records);
      setSelectedRecords(result.records);
      setTaxSummary(result.summary);
      setGrandTotal(result.grandTotal);
      setSelectedScopeSubtotal(result.grandTotal);
    } catch (err) {
      console.error('Assessment load failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this RPTAR property record?')) {
      await api.deleteProperty(id);
      await loadData();
    }
  };

  const handleSaveProperty = async (data: Partial<Property>) => {
    const payload = {
      ...data,
      assessorName: currentUser?.name || 'Juan Reyes',
      stationId: currentUser?.stationId || 'Assessor-Desk-02'
    };

    await api.saveProperty(payload);
    setIsModalOpen(false);
    await loadData();
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
        tenderType: 'CLEARED',
        postedBy: `${currentUser.name} (${currentUser.role} • ${currentUser.stationId})`
      });

      setIssuedReceipt(clearanceSlip);
      setIsReceiptModalOpen(true);

      const updatedResult = await api.getPropertyAssessment(selectedProperty.id, selectedProperty);
      setTaxRecords(updatedResult.records);
      setSelectedRecords(updatedResult.records);
      setGrandTotal(updatedResult.grandTotal);
      setSelectedScopeSubtotal(updatedResult.grandTotal);

      await loadData();
    } catch (err) {
      alert(`Clearance failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessingClearance(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('lgu_user');
    localStorage.removeItem('lgu_token');
    setCurrentUser(null);
    setView('dashboard');
  };

  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const canClearDues = currentUser.role === 'Assessor' || currentUser.role === 'Admin' || currentUser.role === 'Cashier';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 font-sans">
      <Header 
        user={currentUser} 
        onLogout={handleLogout}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
      />

      {/* Live Sync Toast Notification */}
      {syncToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in-up max-w-md text-xs">
          <div className="p-2 bg-blue-600 rounded-xl animate-pulse">
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
                onClick={() => { setView('dashboard'); loadData(); }}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors"
              >
                <ArrowLeft size={16} />
                Back to Masterlist Dashboard
              </button>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleOpenAuditModal(selectedProperty)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-300 rounded-xl transition-all"
                >
                  <RefreshCw size={14} className="text-blue-600" />
                  View Revision Trail
                </button>

                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  <Printer size={15} />
                  Print Statement of Account (SOA)
                </button>
              </div>
            </div>

            {selectedProperty && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Property Card & Clearance Action Box */}
                <div className="lg:col-span-1 space-y-6">
                  <PropertyCard 
                    property={selectedProperty} 
                    onViewAudit={() => handleOpenAuditModal(selectedProperty)}
                  />

                  {/* Sequential Clearance Action Box */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 no-print">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                      <ShieldCheck size={18} className="text-emerald-600" />
                      <h3 className="font-bold text-sm text-slate-800">Sequential Dues Clearance</h3>
                    </div>

                    {taxRecords.length > 0 ? (
                      <div className="space-y-4 text-xs">
                        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                          <p className="font-bold">
                            Selected Scope: {selectedRecords.length} of {taxRecords.length} Quarters
                          </p>
                          <p className="text-[11px] text-blue-700">
                            Under the <strong>Arrears-First rule</strong>, earlier quarters must be settled chronologically before subsequent ones.
                          </p>
                        </div>

                        <div className="pt-2">
                          {canClearDues ? (
                            <button 
                              onClick={handleMarkDuesCleared}
                              disabled={isProcessingClearance || selectedRecords.length === 0}
                              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
                            >
                              <CheckCircle2 size={18} />
                              {isProcessingClearance ? 'Processing Clearance...' : `Mark Selected Dues as Cleared (₱${selectedScopeSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })})`}
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

                {/* Right Column: Statement of Account */}
                <div className="lg:col-span-2">
                  <DelinquencyTable 
                    records={taxRecords} 
                    summary={taxSummary} 
                    grandTotal={grandTotal}
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
        onClose={() => {
          setIsReceiptModalOpen(false);
          setIssuedReceipt(null);
          setView('dashboard');
        }}
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
    </div>
  );
};

export default App;