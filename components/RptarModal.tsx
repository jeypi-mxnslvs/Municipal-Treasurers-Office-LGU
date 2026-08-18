import React, { useState, useEffect } from 'react';
import { Property } from '../types';
import { BARANGAYS, PROPERTY_CLASSES } from '../constants';
import { X, Database, UserPlus, Info } from 'lucide-react';

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
    isShellRecord: false
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
        isShellRecord: false
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
      assessedValue: Math.round(mVal * defaultLevel)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            {isExisting ? <Database className="text-blue-400" size={22} /> : <UserPlus className="text-emerald-400" size={22} />}
            <div>
              <h2 className="font-bold text-base leading-tight">
                {isExisting ? 'Update Property Record (RPTAR)' : 'Encode New Real Property'}
              </h2>
              <p className="text-xs text-slate-400">Assessor Appraisal & Valuation Entry</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Status Banner */}
        {isExisting && (
          <div className={`px-6 py-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${isShell ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
            <Info size={14} />
            {isShell ? 'Provisional Shell Record — Set Full Appraised Valuation' : 'Existing Masterlist Record'}
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TD Number */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Tax Declaration (TD) No. *</label>
              <input 
                type="text" 
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono font-semibold text-slate-800"
                value={formData.tdNumber}
                onChange={(e) => setFormData({ ...formData, tdNumber: e.target.value })}
                placeholder="TD-99-001-0000"
                required
              />
            </div>

            {/* Cadastral PIN */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Cadastral PIN Number</label>
              <input 
                type="text" 
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-slate-800"
                value={formData.pin || ''}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                placeholder="024-05-001-01-001"
              />
            </div>

            {/* Owner Name */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-600 uppercase mb-1">Declared Property Owner *</label>
              <input 
                type="text" 
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold uppercase text-slate-800"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                placeholder="JUAN DELA CRUZ"
                required
              />
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-600 uppercase mb-1">Property Location / Street Address *</label>
              <input 
                type="text" 
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Lot 1 Blk 2, Rizal St."
                required
              />
            </div>

            {/* Barangay */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Barangay</label>
              <select
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                value={formData.barangay}
                onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
              >
                {BARANGAYS.map(brgy => (
                  <option key={brgy} value={brgy}>{brgy}</option>
                ))}
              </select>
            </div>

            {/* Property Class */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Classification *</label>
              <select
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                value={formData.propertyClass}
                onChange={(e) => setFormData({ ...formData, propertyClass: e.target.value as any })}
              >
                {PROPERTY_CLASSES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Lot Area */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Lot Area (sq. meters)</label>
              <input 
                type="number" 
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                value={formData.lotAreaSqm || 100}
                onChange={(e) => setFormData({ ...formData, lotAreaSqm: Number(e.target.value) })}
              />
            </div>

            {/* Previous TD */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Previous ARP/TD Reference</label>
              <input 
                type="text" 
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-slate-800"
                value={formData.previousTdNumber || ''}
                onChange={(e) => setFormData({ ...formData, previousTdNumber: e.target.value })}
                placeholder="Optional"
              />
            </div>

            {/* Direct Market Value */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Direct Market Value (₱) *</label>
              <input 
                type="number" 
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-slate-800"
                value={formData.marketValue || 0}
                onChange={(e) => handleMarketValueChange(Number(e.target.value))}
                required
              />
            </div>

            {/* Direct Assessed Value */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Taxable Assessed Value (₱) *</label>
              <input 
                type="number" 
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-900 font-mono text-sm bg-blue-50/50"
                value={formData.assessedValue || 0}
                onChange={(e) => setFormData({ ...formData, assessedValue: Number(e.target.value), isShellRecord: false })}
                required
              />
            </div>

            {/* Last Year Paid */}
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-600 uppercase mb-1">Last Year Paid (for Historical Tracking)</label>
              <input 
                type="number" 
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                value={formData.lastPaidYear || 2025}
                onChange={(e) => setFormData({ ...formData, lastPaidYear: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-3.5 flex justify-end gap-2.5 border-t border-slate-200">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-all active:scale-95"
          >
            {isExisting ? 'Commit RPTAR Updates' : 'Save Property Record'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RptarModal;