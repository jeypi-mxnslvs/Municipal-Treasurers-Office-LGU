import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Property, TaxYearRecord, User, DashboardStatsData, TaxSummary } from './types';
import { api } from './services/api';
import Header from './components/Header';
import { BreakdownAlertModal } from '@/components/common/BreakdownAlertModal';
import type { AlertSeverity, FieldFailureDetail } from '@/components/common/BreakdownAlertModal';
import { useToast } from '@/components/common/Toast';
import { LoginPage, UserManagementModal, PasswordConfirmationModal } from '@/features/auth';
import SystemMaintenanceModal from '@/features/auth/SystemMaintenanceModal';
import { DashboardStats } from '@/features/dashboard';
import { DashboardTable, PropertyCard, RptarModal, BulkImportModal } from '@/features/properties';
import { DelinquencyTable } from '@/features/assessment';
import ComputationScheduleModal from '@/features/assessment/ComputationScheduleModal';
import VerifyPeriodModal from '@/features/assessment/VerifyPeriodModal';
import type { VerificationModalValue } from '@/features/assessment/VerifyPeriodModal';
import { AuditLogModal } from '@/features/audit';
import { NoticeOfDelinquencyModal, TaxClearanceModal } from '@/features/reports';
import { Printer, ArrowLeft, CheckCircle2, ShieldCheck, CheckCircle, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import { verifySessionToken, DEFAULT_SESSION_TIMEOUT_MS } from './lib/crypto';
import { mergeEncoderLabel } from './utils/encoderAttribution';
import { projectPropertyPeriods, derivePeriodKeyFromRecord } from './utils/periodProjection';
import type { PropertyPeriodProjection } from './utils/periodProjection';
import { auditPropertyForVerification } from './utils/validationPipeline';

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
  const [isSystemMaintenanceModalOpen, setIsSystemMaintenanceModalOpen] = useState(false);
  const [isComputationScheduleModalOpen, setIsComputationScheduleModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditTargetProperty, setAuditTargetProperty] = useState<Property | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [propertyPendingDeletion, setPropertyPendingDeletion] = useState<string | null>(null);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [isTaxClearanceModalOpen, setIsTaxClearanceModalOpen] = useState(false);
  const [clearanceEligibility, setClearanceEligibility] = useState<{
    isEligible: boolean;
    ineligibilityReasons: string[];
    outstandingTotal: number;
    hasUnverifiedPeriods: boolean;
    hasDisputedPeriods: boolean;
    hasHistoricalGaps: boolean;
  } | undefined>();
  const [periodProjection, setPeriodProjection] = useState<PropertyPeriodProjection>();
  const [isVerifyPeriodModalOpen, setIsVerifyPeriodModalOpen] = useState(false);
  const [noticeProperties, setNoticeProperties] = useState<Property[]>([]);
  const [activeComputationSchedule, setActiveComputationSchedule] = useState<{
    versionId?: number;
    authorityReference?: string;
    sourceFileHash?: string;
  }>();

  // Unified Toast hook (replaces the old inline syncToast state)
  const { showToast } = useToast();

  // Breakdown Alert Modal state (replaces window.alert())
  const [breakdownAlert, setBreakdownAlert] = useState<{
    isOpen: boolean;
    severity: AlertSeverity;
    title: string;
    summary: string;
    guidance?: string;
    technicalDetail?: string;
    fieldFailures?: FieldFailureDetail[];
    actionButton?: {
      label: string;
      onClick: () => void;
    };
  }>({
    isOpen: false,
    severity: 'error',
    title: '',
    summary: '',
  });

  const closeBreakdownAlert = useCallback(() => {
    setBreakdownAlert((prev) => ({ ...prev, isOpen: false }));
  }, []);

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
      showToast({
        type: 'sync',
        title: `RPTAR record (${mutation.tdNumber || 'Masterlist'}) was updated [${mutation.action}]`,
        author: mutation.author,
        duration: 5000,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [currentUser, loadData, showToast]);

  const initialRestoredRef = useRef(false);

  const handlePostPaymentView = useCallback(async (property: Property) => {
    if (property.disposition && property.disposition !== 'ACTIVE') {
      showToast({ type: 'warning', title: 'Archived record', message: 'Archived records are view-only and excluded from tax computation.' });
      return;
    }
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
      const [result, completed, verifications] = await Promise.all([
        api.getPropertyAssessment(property.id, property),
        api.getPropertyCompletedRecords(property.id, property),
        api.getPeriodVerifications(property.id),
      ]);
      setTaxSummary(result.summary);
      setActiveComputationSchedule(result.computationSchedule ? {
        versionId: result.computationSchedule.versionId,
        authorityReference: result.computationSchedule.authorityReference,
        sourceFileHash: result.computationSchedule.sourceFileHash,
      } : undefined);
      setGrandTotal(result.grandTotal);
      setSelectedScopeSubtotal(result.grandTotal);
      const projection = projectPropertyPeriods(property, verifications, {
        splitCurrentYearQuarters: true,
        completedPeriodLabels: completed.map(record => record.periodLabel).filter(Boolean) as string[],
        computationSchedule: result.computationSchedule,
        penaltyScheduleOverride: result.computationSchedule?.penaltyRates,
        basicTaxScheduleOverride: result.computationSchedule?.basicTaxRates,
        sefTaxScheduleOverride: result.computationSchedule?.sefTaxRates,
      });
      const projectedByKey = new Map(projection.periods.map(period => [period.periodKey, period]));
      const projectedRecords = result.records.map(record => {
        const key = derivePeriodKeyFromRecord(record);
        const projected = projectedByKey.get(key);
        return projected ? { ...record, verificationStatus: projected.status, sourceReference: projected.sourceReference, clearanceReference: projected.sourceReference, totalDue: projected.totalDue, isPayable: projected.isPayable } : record;
      });
      setTaxRecords(projectedRecords);
      setCompletedTaxRecords(completed);
      setSelectedRecords([]);
      setPeriodProjection(projection);
      setClearanceEligibility({
        isEligible: projection.isClearanceEligible,
        ineligibilityReasons: projection.ineligibilityReasons,
        outstandingTotal: projection.outstandingTotal,
        hasUnverifiedPeriods: projection.hasUnverifiedPeriods,
        hasDisputedPeriods: projection.hasDisputedPeriods,
        hasHistoricalGaps: projection.hasHistoricalGaps,
      });
    } catch (err) {
      console.error('Assessment load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!currentUser || !selectedProperty) return;
    const refreshActiveStatement = () => handlePostPaymentView(selectedProperty);
    const unsubscribe = api.subscribeToMutations((mutation) => {
      if (mutation.tdNumber === selectedProperty.tdNumber) refreshActiveStatement();
    });
    return unsubscribe;
  }, [currentUser, selectedProperty, handlePostPaymentView]);

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

  // Restore Statement of Account on page reload / refresh if explicitly viewing a property via URL query
  useEffect(() => {
    if (!currentUser || properties.length === 0 || initialRestoredRef.current) return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlTd = searchParams.get('td');
      const urlView = searchParams.get('view');

      // Only restore property statement if the URL explicitly specifies a property
      if (urlTd && (urlView === 'posting' || urlView === 'soa' || !urlView)) {
        const targetProperty = properties.find(
          (p) => p.tdNumber === urlTd || String(p.id) === urlTd
        );
        if (targetProperty) {
          initialRestoredRef.current = true;
          handlePostPaymentView(targetProperty);
          return;
        }
      }
      initialRestoredRef.current = true;
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
    if (currentUser?.role !== 'Admin') return;
    const reason = window.prompt('Required archive reason (for example: training sample, duplicate, or cancelled TD):');
    if (!reason?.trim()) return;
    setPropertyPendingDeletion(`${id}::${reason.trim()}`);
  };

  const confirmDeleteProperty = async () => {
    if (!propertyPendingDeletion) return;
    const separator = propertyPendingDeletion.indexOf('::');
    const propertyId = separator >= 0 ? propertyPendingDeletion.slice(0, separator) : propertyPendingDeletion;
    const reason = separator >= 0 ? propertyPendingDeletion.slice(separator + 2) : 'Admin-directed archival';
    await api.archiveProperty(propertyId, reason, currentUser.name, currentUser.role);
    setPropertyPendingDeletion(null);
    await loadData();
  };

  const handleSaveProperty = async (data: Partial<Property>) => {
    try {
      const assessor = currentUser?.name || 'Juan Reyes';
      const mergedEncoderLabel = mergeEncoderLabel(
        data.encoderLabel,
        assessor,
        true
      );

      const payload = {
        ...data,
        entryType: 'MANUAL' as const,
        encoderLabel: mergedEncoderLabel,
        assessorName: assessor,
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
      setBreakdownAlert({
        isOpen: true,
        severity: 'error',
        title: 'Property Save Failed',
        summary: 'The RPTAR property record could not be saved. Please review the details below.',
        guidance: 'Verify that all required fields are correctly filled out. If the issue persists, it may indicate a database connectivity problem — contact the system administrator.',
        technicalDetail: errMsg,
      });
    }
  };

  const handleSelectionChange = (selected: TaxYearRecord[], subtotal: number) => {
    setSelectedRecords(selected);
    setSelectedScopeSubtotal(subtotal);
  };

  const handleVerifySelectedDues = () => {
    if (!selectedProperty || selectedRecords.length === 0 || !currentUser) return;

    const audit = auditPropertyForVerification(selectedProperty);
    if (!audit.canVerify) {
      setBreakdownAlert({
        isOpen: true,
        severity: 'policy',
        title: 'Parcel Incomplete — Verification Blocked',
        summary: `Property TD ${selectedProperty.tdNumber} has incomplete cadastral or assessment fields. Under Republic Act No. 7160 and municipal Treasury protocol, delinquency verifications and clearance certificates cannot be recorded on provisional shell records.`,
        guidance: 'Review the missing or malformed fields listed below. Click "Update Parcel in Masterlist" to provide the required cadastral PIN or assessed valuation.',
        technicalDetail: `Audit Rule: RA 7160 Sec. 219 / 254 (Shell Record Restriction) | Property ID: ${selectedProperty.id} | TD: ${selectedProperty.tdNumber}`,
        fieldFailures: audit.failures,
        actionButton: {
          label: 'Update Parcel in Masterlist',
          onClick: () => {
            closeBreakdownAlert();
            handleOpenEditModal(selectedProperty);
          },
        },
      });
      return;
    }

    if (!activeComputationSchedule?.versionId || !activeComputationSchedule.authorityReference || !activeComputationSchedule.sourceFileHash) {
      setBreakdownAlert({
        isOpen: true,
        severity: 'policy',
        title: 'Verification Blocked — No Active Computation Schedule',
        summary: 'An active approved computation schedule is required before delinquency verification can be recorded.',
        guidance: 'Ask an authorized Treasurer/Admin user to validate and activate an official computation schedule, then reload this property.',
        technicalDetail: 'Verification provenance requires active schedule version, authority reference, and source hash.',
      });
      return;
    }

    setIsVerifyPeriodModalOpen(true);
  };

  const handleSubmitVerification = async (verification: VerificationModalValue) => {
    if (!selectedProperty || selectedRecords.length === 0 || !currentUser) return;

    setIsProcessingClearance(true);
    try {
      await api.verifyDelinquencyPeriodBatch({
        propertyId: selectedProperty.id,
        tdNumber: selectedProperty.tdNumber,
        periods: selectedRecords.map((record) => ({
          periodKey: record.periodKey || record.periodLabel || String(record.year),
          taxYear: record.year,
          periodLabel: record.periodLabel || `Tax Year ${record.year}`,
          status: verification.status,
          verificationType: verification.status === 'VERIFIED_SETTLED_EXTERNALLY'
            ? 'EXTERNAL_SETTLEMENT_EVIDENCE'
            : 'DELINQUENCY',
          evidenceType: verification.evidenceType,
          sourceReference: verification.sourceReference || undefined,
          remarks: verification.remarks || undefined,
        })),
        verifiedBy: currentUser.id,
        stationId: currentUser.stationId,
        computationSchedule: activeComputationSchedule,
      });
      setIsVerifyPeriodModalOpen(false);

      showToast({
        type: 'success',
        title: 'Delinquency Verified',
        message: `${selectedRecords.length} delinquency ${selectedRecords.length === 1 ? 'period' : 'periods'} verified and recorded successfully.`
      });

      const [updatedResult, updatedCompleted, updatedVerifications] = await Promise.all([
        api.getPropertyAssessment(selectedProperty.id, selectedProperty),
        api.getPropertyCompletedRecords(selectedProperty.id, selectedProperty),
        api.getPeriodVerifications(selectedProperty.id),
      ]);
      setGrandTotal(updatedResult.grandTotal);
      setActiveComputationSchedule(updatedResult.computationSchedule ? {
        versionId: updatedResult.computationSchedule.versionId,
        authorityReference: updatedResult.computationSchedule.authorityReference,
        sourceFileHash: updatedResult.computationSchedule.sourceFileHash,
      } : undefined);
      setSelectedScopeSubtotal(updatedResult.grandTotal);
      const updatedProjection = projectPropertyPeriods(selectedProperty, updatedVerifications, {
        splitCurrentYearQuarters: true,
        completedPeriodLabels: updatedCompleted.map(record => record.periodLabel).filter(Boolean) as string[],
        computationSchedule: updatedResult.computationSchedule,
        penaltyScheduleOverride: updatedResult.computationSchedule?.penaltyRates,
        basicTaxScheduleOverride: updatedResult.computationSchedule?.basicTaxRates,
        sefTaxScheduleOverride: updatedResult.computationSchedule?.sefTaxRates,
      });
      const updatedProjectedByKey = new Map(updatedProjection.periods.map(period => [period.periodKey, period]));
      const updatedProjectedRecords = updatedResult.records.map(record => {
        const key = derivePeriodKeyFromRecord(record);
        const projected = updatedProjectedByKey.get(key);
        return projected ? { ...record, verificationStatus: projected.status, sourceReference: projected.sourceReference, clearanceReference: projected.sourceReference, totalDue: projected.totalDue, isPayable: projected.isPayable } : record;
      });
      setTaxRecords(updatedProjectedRecords);
      setCompletedTaxRecords(updatedCompleted);
      setSelectedRecords([]);
      setPeriodProjection(updatedProjection);
      setClearanceEligibility({
        isEligible: updatedProjection.isClearanceEligible,
        ineligibilityReasons: updatedProjection.ineligibilityReasons,
        outstandingTotal: updatedProjection.outstandingTotal,
        hasUnverifiedPeriods: updatedProjection.hasUnverifiedPeriods,
        hasDisputedPeriods: updatedProjection.hasDisputedPeriods,
        hasHistoricalGaps: updatedProjection.hasHistoricalGaps,
      });

      if (updatedResult.computationSchedule?.unavailable) {
        showToast({
          type: 'warning',
          title: 'Built-in computation baseline in use',
          message: 'No active approved computation schedule was found. Review schedule availability before issuing a statement or clearance.',
        });
      }

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

      if (updatedResult.records.length === 0 && updatedProjection.isClearanceEligible) {
        setIsTaxClearanceModalOpen(true);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      const audit = auditPropertyForVerification(selectedProperty);
      const isShellError = errMsg.includes('Shell records cannot be verified') || !audit.canVerify;

      setBreakdownAlert({
        isOpen: true,
        severity: 'error',
        title: isShellError ? 'Verification Rejected: Incomplete Shell Record' : 'Verification Failed',
        summary: isShellError
          ? `This parcel (TD: ${selectedProperty.tdNumber}) cannot be verified because it lacks required cadastral data (verified PIN or non-zero assessed valuation) mandated by RA 7160.`
          : 'The sequential period verification could not be recorded.',
        guidance: isShellError
          ? 'Update the parcel in the masterlist with a valid cadastral PIN and positive taxable valuation before recording verifications.'
          : 'Verify database connectivity and permissions. Batch transaction was rejected; refresh before retrying.',
        technicalDetail: errMsg,
        fieldFailures: audit.failures.length > 0 ? audit.failures : undefined,
        actionButton: audit.failures.length > 0 ? {
          label: 'Update Parcel in Masterlist',
          onClick: () => {
            closeBreakdownAlert();
            handleOpenEditModal(selectedProperty);
          },
        } : undefined,
      });
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

  const canClearDues = currentUser.role === 'Assessor' || currentUser.role === 'Admin';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/80 text-slate-800 font-sans">
      <Header 
        user={currentUser} 
        onLogout={() => handleLogout()}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        onOpenComputationSchedules={() => setIsComputationScheduleModalOpen(true)}
        onOpenSystemMaintenance={() => setIsSystemMaintenanceModalOpen(true)}
        onOpenBatchNotices={() => {
          const delinquents = properties.filter(p => p.lastPaidYear < 2026 && !p.isShellRecord);
          setNoticeProperties(delinquents);
          setIsNoticeModalOpen(true);
        }}
      />

      {/* Breakdown Alert Modal — replaces all window.alert() calls */}
      <BreakdownAlertModal
        isOpen={breakdownAlert.isOpen}
        onClose={closeBreakdownAlert}
        severity={breakdownAlert.severity}
        title={breakdownAlert.title}
        summary={breakdownAlert.summary}
        guidance={breakdownAlert.guidance}
        technicalDetail={breakdownAlert.technicalDetail}
        fieldFailures={breakdownAlert.fieldFailures}
        actionButton={breakdownAlert.actionButton}
      />

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
              <div className="space-y-6">
                {/* Top Section: Property Information Banner & Sequential Dues Clearance Card */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Property Master Info Card */}
                  <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
                    <PropertyCard 
                      property={selectedProperty} 
                      onViewAudit={() => handleOpenAuditModal(selectedProperty)}
                    />
                  </div>

                  {/* Sequential Dues Clearance Action Box */}
                  <div className="lg:col-span-5 xl:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 no-print">
                    <div>
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                        <ShieldCheck size={18} className="text-emerald-600" />
                        <h3 className="font-bold text-sm text-slate-800">Sequential Dues Clearance</h3>
                      </div>

                      {taxRecords.length > 0 ? (
                        <div className="space-y-3 text-xs pt-3">
                          <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                            <p className="font-bold">
                              Selected Scope: {selectedRecords.length} of {taxRecords.length} {taxRecords.length === 1 ? 'Tax Period' : 'Tax Periods'}
                            </p>
                            <p className="text-[11px] text-emerald-800">
                              Under the <strong>Arrears-First rule</strong>, earlier tax periods must be settled chronologically before subsequent ones.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center text-xs font-bold flex flex-col items-center justify-center gap-2 mt-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle size={18} className="text-emerald-600" />
                            Account is fully cleared. Zero liabilities.
                          </div>
                          <button
                            onClick={() => setIsTaxClearanceModalOpen(true)}
                            className="mt-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <ShieldCheck size={14} />
                            Generate Tax Clearance Certificate
                          </button>
                        </div>
                      )}

                      {/* Proactive Incomplete Parcel Warning Alert */}
                      {(() => {
                        const propertyAudit = selectedProperty ? auditPropertyForVerification(selectedProperty) : { canVerify: true, failures: [] };
                        if (!propertyAudit.canVerify) {
                          return (
                            <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl text-amber-950 space-y-2">
                              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                                <span>Incomplete Parcel Record ({propertyAudit.failures.length} {propertyAudit.failures.length === 1 ? 'requirement' : 'requirements'} incomplete)</span>
                              </div>
                              <p className="text-[11px] text-amber-800 leading-relaxed">
                                Under RA 7160 Sec. 219 & 254, delinquency periods cannot be verified until all cadastral and valuation fields are satisfied.
                              </p>
                              <div className="space-y-1 pt-0.5">
                                {propertyAudit.failures.map((f, i) => (
                                  <div key={i} className="text-[11px] text-amber-900 bg-amber-100/80 px-2 py-1 rounded border border-amber-200">
                                    <strong>{f.field}:</strong> {f.requirement}
                                  </div>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(selectedProperty)}
                                className="w-full mt-1.5 px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                Complete Parcel in Masterlist
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {taxRecords.length > 0 && (
                      <div className="pt-2">
                        {canClearDues ? (
                          <button 
                            onClick={handleVerifySelectedDues}
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
                                {isProcessingClearance ? 'Recording Verifications...' : 'Verify Selected Delinquency Periods'}
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
                            Log in as <strong>Assessor</strong> or <strong>Admin</strong> to verify delinquency periods.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Full-Width Statement of Account (SOA) Table */}
                <div className="w-full">
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
        currentUser={currentUser || undefined}
      />

      {/* Official Tax Clearance Certificate Modal */}
      <TaxClearanceModal
        isOpen={isTaxClearanceModalOpen}
        onClose={() => setIsTaxClearanceModalOpen(false)}
        property={selectedProperty}
        currentUser={currentUser}
        eligibility={clearanceEligibility}
      />

      <VerifyPeriodModal
        isOpen={isVerifyPeriodModalOpen}
        records={selectedRecords}
        onClose={() => setIsVerifyPeriodModalOpen(false)}
        onSubmit={handleSubmitVerification}
        isSubmitting={isProcessingClearance}
      />

      {/* Admin User Management Modal */}
      <UserManagementModal
        isOpen={isUserManagementModalOpen}
        onClose={() => setIsUserManagementModalOpen(false)}
        currentUser={currentUser}
      />
      <SystemMaintenanceModal isOpen={isSystemMaintenanceModalOpen} onClose={() => setIsSystemMaintenanceModalOpen(false)} currentUser={currentUser} />

      <ComputationScheduleModal
        isOpen={isComputationScheduleModalOpen}
        onClose={() => setIsComputationScheduleModalOpen(false)}
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
        title="Authorize Property Archival"
        description="This retains record for audit but removes it from active operations. Confirm Admin password to archive it."
        username={currentUser?.username || 'admin'}
        destructiveActionLabel="Archive Record"
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
        periodProjection={noticeProperties.length === 0 ? periodProjection : undefined}
      />
    </div>
  );
};

export default App;
