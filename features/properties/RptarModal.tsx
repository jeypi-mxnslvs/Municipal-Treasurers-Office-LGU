import React, { useState, useEffect } from 'react';
import { Property, User } from '@/types';
import { BARANGAYS, PROPERTY_CLASSES } from '@/constants';
import { mergeEncoderLabel } from '@/utils/encoderAttribution';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, UserPlus, Info, AlertCircle } from 'lucide-react';
import {
  validatePropertyForm,
  FormErrors,
  SANTA_ROSA_BARANGAY_CODES,
} from '@/utils/validationPipeline';

interface RptarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (property: Partial<Property>) => void;
  initialData?: Property | null;
  currentUser?: User;
}

const getBarangayCode = (brgy?: string): string => {
  if (!brgy) return '23001';
  if (SANTA_ROSA_BARANGAY_CODES[brgy]) return SANTA_ROSA_BARANGAY_CODES[brgy];
  const foundKey = Object.keys(SANTA_ROSA_BARANGAY_CODES).find(
    (k) =>
      k.toLowerCase() === brgy.toLowerCase() ||
      k.toLowerCase().startsWith(brgy.toLowerCase().split(' ')[0])
  );
  return foundKey ? SANTA_ROSA_BARANGAY_CODES[foundKey] : '23001';
};

const RptarModal: React.FC<RptarModalProps> = ({ isOpen, onClose, onSave, initialData, currentUser }) => {
  const [formData, setFormData] = useState<Partial<Property>>({
    tdNumber: '',
    previousTdNumber: '',
    pin: '',
    ownerName: '',
    barangay: BARANGAYS[0],
    address: '',
    propertyClass: 'Residential',
    lotAreaSqm: 0,
    marketValue: 0,
    assessedValue: 0,
    lastPaidYear: 2025,
    isShellRecord: false,
  });

  const [isExisting, setIsExisting] = useState(false);
  const [isShell, setIsShell] = useState(false);
  const [isCustomMarketValue, setIsCustomMarketValue] = useState(false);

  // String state for numerical inputs to allow seamless backspacing without persistent '0'
  const [assessedValueStr, setAssessedValueStr] = useState<string>('0');
  const [marketValueStr, setMarketValueStr] = useState<string>('0');
  const [lotAreaStr, setLotAreaStr] = useState<string>('0');
  const [lastPaidYearStr, setLastPaidYearStr] = useState<string>('2025');

  // Inline validation errors state
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const clearFieldError = (fieldName: string) => {
    if (formErrors[fieldName]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const getAssessmentLevel = (propertyClass?: string) => {
    return propertyClass === 'Commercial' || propertyClass === 'Industrial' ? 0.50 : 0.20;
  };

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setIsExisting(true);
      setIsShell(Boolean(initialData.isShellRecord));
      setIsCustomMarketValue(Boolean(initialData.marketValue && initialData.marketValue > 0));
      setAssessedValueStr(initialData.assessedValue !== undefined ? String(initialData.assessedValue) : '0');
      setMarketValueStr(initialData.marketValue !== undefined ? String(initialData.marketValue) : '0');
      setLotAreaStr(initialData.lotAreaSqm !== undefined ? String(initialData.lotAreaSqm) : '0');
      setLastPaidYearStr(initialData.lastPaidYear !== undefined ? String(initialData.lastPaidYear) : '2025');
    } else {
      const defaultBrgy = BARANGAYS[0];
      setFormData({
        tdNumber: '',
        previousTdNumber: '',
        pin: '',
        ownerName: '',
        barangay: defaultBrgy,
        address: '',
        propertyClass: 'Residential',
        lotAreaSqm: 0,
        marketValue: 0,
        assessedValue: 0,
        lastPaidYear: 2025,
        isShellRecord: false,
      });
      setIsExisting(false);
      setIsShell(false);
      setIsCustomMarketValue(false);
      setAssessedValueStr('0');
      setMarketValueStr('0');
      setLotAreaStr('0');
      setLastPaidYearStr('2025');
    }
    setFormErrors({});
  }, [initialData, isOpen]);

  // When barangay changes, only update barangay code in TD number if an existing 17-23xxx pattern was already entered
  const handleBarangayChange = (newBrgy: string) => {
    clearFieldError('tdNumber');
    const newCode = getBarangayCode(newBrgy);
    setFormData((prev) => {
      let updatedTd = prev.tdNumber || '';
      const tdPattern = /^((?:17|TD|td)-)23\d{3}(.*)$/;
      if (tdPattern.test(updatedTd)) {
        updatedTd = updatedTd.replace(tdPattern, `$1${newCode}$2`);
      }
      return {
        ...prev,
        barangay: newBrgy,
        tdNumber: updatedTd,
      };
    });
  };

  // Primary handler: Assessed value is the fundamental tax base for Treasury billing
  const handleAssessedValueChange = (valStr: string) => {
    clearFieldError('assessedValue');
    setAssessedValueStr(valStr);
    const num = parseFloat(valStr);
    const aVal = isNaN(num) ? 0 : num;
    const level = getAssessmentLevel(formData.propertyClass);
    setFormData((prev) => ({
      ...prev,
      assessedValue: aVal,
      marketValue: isCustomMarketValue ? prev.marketValue : Math.round(aVal / level),
      isShellRecord: aVal <= 0 || !formData.pin?.trim(),
    }));
    if (!isCustomMarketValue) {
      const autoMv = isNaN(num) || num <= 0 ? 0 : Math.round(num / level);
      setMarketValueStr(autoMv > 0 ? String(autoMv) : '0');
    }
  };

  // Optional handler: User can explicitly customize Market Value without overwriting Assessed Value
  const handleMarketValueChange = (valStr: string) => {
    setIsCustomMarketValue(true);
    setMarketValueStr(valStr);
    const num = parseFloat(valStr);
    setFormData((prev) => ({
      ...prev,
      marketValue: isNaN(num) ? 0 : num,
    }));
  };

  const handlePropertyClassChange = (newClass: string) => {
    const level = getAssessmentLevel(newClass);
    const aVal = parseFloat(assessedValueStr) || 0;
    setFormData((prev) => {
      const newMv = isCustomMarketValue ? (parseFloat(marketValueStr) || 0) : Math.round(aVal / level);
      return {
        ...prev,
        propertyClass: newClass,
        marketValue: newMv,
      };
    });
    if (!isCustomMarketValue) {
      const autoMv = aVal > 0 ? Math.round(aVal / level) : 0;
      setMarketValueStr(autoMv > 0 ? String(autoMv) : '0');
    }
  };

  const handleSave = () => {
    // Execute validation pipeline constraints
    const validationErrors = validatePropertyForm({
      tdNumber: formData.tdNumber,
      ownerName: formData.ownerName,
      assessedValue: assessedValueStr,
      lotAreaSqm: lotAreaStr,
      lastPaidYear: lastPaidYearStr,
      barangay: formData.barangay,
    });

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }
    setFormErrors({});

    const level = getAssessmentLevel(formData.propertyClass);
    const parsedAssessed = parseFloat(assessedValueStr);
    const finalAssessed = isNaN(parsedAssessed) ? 0 : parsedAssessed;
    const finalMarket =
      marketValueStr && parseFloat(marketValueStr) > 0
        ? parseFloat(marketValueStr)
        : Math.round(finalAssessed / level);
    const parsedLotArea = parseFloat(lotAreaStr);
    const finalLotArea = isNaN(parsedLotArea) ? 0 : parsedLotArea;
    const parsedLastPaid = parseInt(lastPaidYearStr, 10);
    const finalLastPaid = isNaN(parsedLastPaid) ? 2025 : parsedLastPaid;

    const finalEncoderLabel = mergeEncoderLabel(
      formData.encoderLabel,
      currentUser?.name || 'Assessor',
      true
    );

    onSave({
      ...formData,
      lotAreaSqm: finalLotArea,
      lastPaidYear: finalLastPaid,
      assessedValue: finalAssessed,
      marketValue: finalMarket,
      isShellRecord: finalAssessed <= 0 || !formData.pin?.trim(),
      entryType: 'MANUAL',
      encoderLabel: finalEncoderLabel,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] p-0 flex flex-col overflow-hidden gap-0">
        {/* Modal Header */}
        <DialogHeader className="bg-slate-900 px-6 py-4 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg shrink-0">
              {isExisting ? (
                <Database className="text-blue-400" size={20} />
              ) : (
                <UserPlus className="text-emerald-400" size={20} />
              )}
            </div>
            <div>
              <DialogTitle className="font-bold text-base leading-tight text-white">
                {isExisting ? 'Update Property Record (RPTAR)' : 'Encode New Real Property'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Assessor Appraisal & Valuation Entry
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Status Banner - only displayed for existing/shell records */}
        {isExisting && (
          <div
            className={`px-6 py-2.5 flex items-center justify-between border-b ${
              isShell
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Info size={14} className={isShell ? 'text-amber-600' : 'text-blue-600'} />
              <span>
                {isShell
                  ? 'Provisional Shell Record — Set Full Appraised Valuation'
                  : 'Existing Masterlist Record'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {formData.encoderLabel && (
                <span className="text-[10px] text-slate-500 font-sans">
                  By: <strong className="text-slate-700">{formData.encoderLabel}</strong>
                </span>
              )}
              <Badge variant={isShell ? 'warning' : 'secondary'} className="text-[10px]">
                {isShell ? 'SHELL RECORD' : 'VERIFIED'}
              </Badge>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {Object.keys(formErrors).length > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={15} className="text-rose-600 shrink-0" />
              <span>Please correct the highlighted fields before saving the record.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TD Number */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Tax-Declaration (TD) No. *
              </label>
              <Input
                type="text"
                className={`bg-slate-50 font-mono font-semibold ${
                  formErrors.tdNumber ? 'border-rose-500 focus-visible:ring-rose-500/20' : ''
                }`}
                value={formData.tdNumber || ''}
                onChange={(e) => {
                  clearFieldError('tdNumber');
                  setFormData({ ...formData, tdNumber: e.target.value });
                }}
                placeholder={`TD-${getBarangayCode(formData.barangay)}-00000`}
                required
              />
              {formErrors.tdNumber ? (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{formErrors.tdNumber}</p>
              ) : (
                <p className="text-[10px] text-slate-500 mt-1">
                  Format: <span className="font-mono font-bold text-slate-700">17-{getBarangayCode(formData.barangay)}-00000</span>
                </p>
              )}
            </div>

            {/* Cadastral PIN */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Cadastral PIN Number
              </label>
              <Input
                type="text"
                className="font-mono"
                value={formData.pin || ''}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                placeholder="024-05-001-01-001"
              />
            </div>

            {/* Owner Name */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Declared Property Owner *
              </label>
              <Input
                type="text"
                className={`font-semibold ${
                  formErrors.ownerName ? 'border-rose-500 focus-visible:ring-rose-500/20' : ''
                }`}
                value={formData.ownerName || ''}
                onChange={(e) => {
                  clearFieldError('ownerName');
                  setFormData({ ...formData, ownerName: e.target.value });
                }}
                placeholder="Juan Dela Cruz"
                required
              />
              {formErrors.ownerName && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{formErrors.ownerName}</p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Property Location / Street Address *
              </label>
              <Input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Lot 1 Blk 2, Rizal St."
                required
              />
            </div>

            {/* Barangay */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Barangay</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                value={formData.barangay}
                onChange={(e) => handleBarangayChange(e.target.value)}
              >
                {BARANGAYS.map((brgy) => (
                  <option key={brgy} value={brgy}>
                    {brgy} ({getBarangayCode(brgy)})
                  </option>
                ))}
              </select>
            </div>

            {/* Property Class */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Classification *
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                value={formData.propertyClass}
                onChange={(e) => handlePropertyClassChange(e.target.value)}
              >
                {PROPERTY_CLASSES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Lot Area */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Lot Area (sq. meters)
              </label>
              <Input
                type="number"
                min="0"
                step="any"
                className={`font-mono ${
                  formErrors.lotAreaSqm ? 'border-rose-500 focus-visible:ring-rose-500/20' : ''
                }`}
                value={lotAreaStr}
                onChange={(e) => {
                  clearFieldError('lotAreaSqm');
                  setLotAreaStr(e.target.value);
                }}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.select();
                }}
                placeholder="0"
              />
              {formErrors.lotAreaSqm && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{formErrors.lotAreaSqm}</p>
              )}
            </div>

            {/* Previous TD */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Previous ARP/TD Reference
              </label>
              <Input
                type="text"
                className="font-mono"
                value={formData.previousTdNumber || ''}
                onChange={(e) => setFormData({ ...formData, previousTdNumber: e.target.value })}
                placeholder="Optional"
              />
            </div>

            {/* Primary Tax Base: Taxable Assessed Value */}
            <div className="md:col-span-2 p-4 bg-[#f4f7f5] rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between mb-0.5">
                <label className="block font-bold text-slate-800 text-xs tracking-wider">
                  Taxable Assessed Value (₱) *
                </label>
                <Badge variant="outline" className="bg-white border-slate-300 text-slate-600 text-[10px] font-semibold">
                  Primary Tax Base
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Official tax base from Tax Declaration. Real Property Tax (1% Basic + 1% SEF) and delinquency penalties are computed exclusively on this figure.
              </p>
              <Input
                type="number"
                min="0"
                step="any"
                className={`h-11 font-bold text-slate-900 font-mono text-base bg-white rounded-lg shadow-2xs ${
                  formErrors.assessedValue
                    ? 'border-rose-500 focus-visible:ring-rose-500/20 focus-visible:border-rose-500'
                    : 'border-slate-300/90 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600'
                }`}
                value={assessedValueStr}
                onChange={(e) => handleAssessedValueChange(e.target.value)}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.select();
                }}
                required
                placeholder="0"
              />
              {formErrors.assessedValue && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{formErrors.assessedValue}</p>
              )}
            </div>

            {/* Optional Reference Section: Market Valuation (BLGF & Audit Reference) */}
            <div className="md:col-span-2 p-4 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="font-bold text-slate-800 text-xs tracking-wider">
                    Market Valuation (BLGF & Audit Reference)
                  </label>
                  <Badge variant="outline" className="text-[10px] font-semibold text-slate-500 bg-white border-slate-300">
                    Optional
                  </Badge>
                </div>
                <span className="text-[10px] font-mono font-medium text-slate-500">
                  Assessment Rate: {Math.round(getAssessmentLevel(formData.propertyClass) * 100)}% ({formData.propertyClass})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Appraisal value from Tax Declaration. If omitted, auto-calculated from the Assessed Value for statutory BLGF Form 3 and COA audit compliance.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Fair Market Value (₱)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="font-mono text-sm bg-white"
                    value={marketValueStr}
                    onChange={(e) => handleMarketValueChange(e.target.value)}
                    onFocus={(e) => {
                      if (e.target.value === '0') e.target.select();
                    }}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Statutory Ceiling Ratio
                  </label>
                  <div className="h-9 px-3 flex items-center bg-white border border-slate-200 rounded-md text-xs font-mono text-slate-600">
                    RA 7160 Sec. 218: Max {Math.round(getAssessmentLevel(formData.propertyClass) * 100)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Last Year Paid */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Last Year Paid (for Historical Tracking)
              </label>
              <Input
                type="number"
                className={`font-mono ${
                  formErrors.lastPaidYear ? 'border-rose-500 focus-visible:ring-rose-500/20' : ''
                }`}
                value={lastPaidYearStr}
                onChange={(e) => {
                  clearFieldError('lastPaidYear');
                  setLastPaidYearStr(e.target.value);
                }}
                onFocus={(e) => {
                  if (e.target.value === '0') e.target.select();
                }}
                placeholder="2025"
              />
              {formErrors.lastPaidYear && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">{formErrors.lastPaidYear}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="bg-slate-50 px-6 py-3.5 flex justify-end gap-2.5 border-t border-slate-200 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 shadow-sm text-white"
          >
            {isExisting ? 'Commit RPTAR Updates' : 'Save Property Record'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RptarModal;
