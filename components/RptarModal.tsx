import React, { useState, useEffect } from 'react';
import { Property } from '../types';
import { BARANGAYS, PROPERTY_CLASSES } from '../constants';
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
import { Database, UserPlus, Info } from 'lucide-react';

interface RptarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (property: Partial<Property>) => void;
  initialData?: Property | null;
}

const RptarModal: React.FC<RptarModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState<Partial<Property>>({
    tdNumber: '',
    previousTdNumber: '',
    pin: '',
    ownerName: '',
    barangay: BARANGAYS[0],
    address: '',
    propertyClass: 'Residential',
    lotAreaSqm: 150,
    marketValue: 300000,
    assessedValue: 60000,
    lastPaidYear: 2025,
    isShellRecord: false,
  });

  const [isExisting, setIsExisting] = useState(false);
  const [isShell, setIsShell] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setIsExisting(true);
      setIsShell(Boolean(initialData.isShellRecord));
    } else {
      setFormData({
        tdNumber: '',
        previousTdNumber: '',
        pin: '',
        ownerName: '',
        barangay: BARANGAYS[0],
        address: '',
        propertyClass: 'Residential',
        lotAreaSqm: 150,
        marketValue: 300000,
        assessedValue: 60000,
        lastPaidYear: 2025,
        isShellRecord: false,
      });
      setIsExisting(false);
      setIsShell(false);
    }
  }, [initialData, isOpen]);

  // Quick helper to auto-estimate assessed value when market value changes (20% for residential, 50% for commercial/industrial)
  const handleMarketValueChange = (mVal: number) => {
    const defaultLevel = formData.propertyClass === 'Residential' ? 0.20 : 0.50;
    setFormData(prev => ({
      ...prev,
      marketValue: mVal,
      assessedValue: Math.round(mVal * defaultLevel),
    }));
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

        {/* Status Banner */}
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
            <Badge variant={isShell ? 'warning' : 'secondary'} className="text-[10px]">
              {isShell ? 'SHELL RECORD' : 'VERIFIED'}
            </Badge>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TD Number */}
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Tax Declaration (TD) No. *
              </label>
              <Input
                type="text"
                className="bg-slate-50 font-mono font-semibold"
                value={formData.tdNumber || ''}
                onChange={(e) => setFormData({ ...formData, tdNumber: e.target.value })}
                placeholder="TD-99-001-0000"
                required
              />
            </div>

            {/* Cadastral PIN */}
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
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
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Declared Property Owner *
              </label>
              <Input
                type="text"
                className="font-semibold uppercase"
                value={formData.ownerName || ''}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                placeholder="JUAN DELA CRUZ"
                required
              />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 uppercase mb-1">
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
              <label className="block font-bold text-slate-700 uppercase mb-1">Barangay</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                value={formData.barangay}
                onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
              >
                {BARANGAYS.map((brgy) => (
                  <option key={brgy} value={brgy}>
                    {brgy}
                  </option>
                ))}
              </select>
            </div>

            {/* Property Class */}
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Classification *
              </label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
                value={formData.propertyClass}
                onChange={(e) => setFormData({ ...formData, propertyClass: e.target.value })}
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
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Lot Area (sq. meters)
              </label>
              <Input
                type="number"
                className="font-mono"
                value={formData.lotAreaSqm || 100}
                onChange={(e) => setFormData({ ...formData, lotAreaSqm: Number(e.target.value) })}
              />
            </div>

            {/* Previous TD */}
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
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

            {/* Direct Market Value */}
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Direct Market Value (₱) *
              </label>
              <Input
                type="number"
                className="font-mono"
                value={formData.marketValue || 0}
                onChange={(e) => handleMarketValueChange(Number(e.target.value))}
                required
              />
            </div>

            {/* Direct Assessed Value */}
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Taxable Assessed Value (₱) *
              </label>
              <Input
                type="number"
                className="font-bold text-slate-900 font-mono text-sm bg-blue-50/50"
                value={formData.assessedValue || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assessedValue: Number(e.target.value),
                    isShellRecord: false,
                  })
                }
                required
              />
            </div>

            {/* Last Year Paid */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Last Year Paid (for Historical Tracking)
              </label>
              <Input
                type="number"
                className="font-mono"
                value={formData.lastPaidYear || 2025}
                onChange={(e) => setFormData({ ...formData, lastPaidYear: Number(e.target.value) })}
              />
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
            onClick={() => onSave(formData)}
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