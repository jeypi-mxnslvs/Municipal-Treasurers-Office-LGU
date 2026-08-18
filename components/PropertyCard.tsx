import React from 'react';
import { Property } from '../types';
import { MapPin, User, FileText, TrendingUp, CalendarCheck, History } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  onViewAudit?: () => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onViewAudit }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex justify-between items-center">
        <h3 className="text-slate-800 font-bold text-sm flex items-center gap-2">
          <FileText size={16} className="text-blue-600" />
          RPTAR Property Master
        </h3>
        <div className="flex items-center gap-2">
          {onViewAudit && (
            <button
              onClick={onViewAudit}
              className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold shadow-xs transition-colors"
              title="View RPTAR Change History & Assessor Trail"
            >
              <History size={13} className="text-blue-600" />
              History
            </button>
          )}

          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${
            property.propertyClass === 'Residential' ? 'bg-green-100 text-green-700 border-green-200' :
            property.propertyClass === 'Commercial' ? 'bg-blue-100 text-blue-700 border-blue-200' :
            'bg-orange-100 text-orange-700 border-orange-200'
          }`}>
            {property.propertyClass}
          </span>
        </div>
      </div>
      
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="space-y-3">
          <div>
            <label className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Declared Property Owner</label>
            <div className="flex items-center gap-1.5 mt-0.5">
              <User size={15} className="text-slate-400" />
              <p className="text-slate-900 font-bold uppercase">{property.ownerName}</p>
            </div>
          </div>
          <div>
            <label className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Tax Declaration (TD) No.</label>
            <p className="text-slate-900 font-mono font-bold mt-0.5">{property.tdNumber}</p>
          </div>
          {property.pin && (
            <div>
              <label className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Cadastral PIN</label>
              <p className="text-slate-700 font-mono mt-0.5">{property.pin}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Taxable Assessed Value</label>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TrendingUp size={15} className="text-blue-600" />
              <p className="text-slate-900 font-black text-base font-mono">
                ₱{property.assessedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div>
            <label className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Last Paid Calendar Year</label>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CalendarCheck size={15} className="text-emerald-600" />
              <p className="text-slate-800 font-semibold">{property.lastPaidYear}</p>
            </div>
          </div>
          <div>
            <label className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Lot Area</label>
            <p className="text-slate-700 font-mono">{property.lotAreaSqm || 100} sq.m</p>
          </div>
        </div>

        <div className="md:col-span-2 pt-3 border-t border-slate-100">
          <label className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Street Address & Barangay</label>
          <div className="flex items-start gap-1.5 mt-0.5">
            <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-slate-800 font-medium">{property.address}, Brgy. {property.barangay}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;