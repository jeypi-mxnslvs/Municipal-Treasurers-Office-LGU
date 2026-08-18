import React, { useState } from 'react';
import { Property, User } from '../types';
import { BARANGAYS } from '../constants';
import { calculateTaxLiability } from '../utils/taxLogic';
import { Search, CheckCircle2, MoreVertical, Plus, Trash2, CreditCard, Edit3, Filter, AlertCircle, ChevronLeft, ChevronRight, History, FileSpreadsheet } from 'lucide-react';

interface DashboardTableProps {
  properties: Property[];
  currentUser: User;
  onSelectProperty: (property: Property) => void;
  onAddProperty: () => void;
  onEditProperty: (property: Property) => void;
  onDeleteProperty: (id: string) => void;
  onViewAudit?: (property: Property) => void;
  onOpenBulkModal?: () => void;
}

const ITEMS_PER_PAGE = 5;

const DashboardTable: React.FC<DashboardTableProps> = ({
  properties,
  currentUser,
  onSelectProperty,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  onViewAudit,
  onOpenBulkModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProperties = properties.filter(p => {
    const matchesSearch =
      p.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tdNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.pin && p.pin.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesBarangay =
      selectedBarangay === 'All' || p.barangay === selectedBarangay;

    const propertyStatus = p.status || (p.totalDebt === 0 ? 'CLEARED' : 'DELINQUENT');
    const matchesStatus =
      selectedStatus === 'All' || propertyStatus === selectedStatus;

    return matchesSearch && matchesBarangay && matchesStatus;
  });

  // Pagination Math
  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedProperties = filteredProperties.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const canEdit = currentUser.role === 'Admin' || currentUser.role === 'Assessor';
  const canDelete = currentUser.role === 'Admin';
  const canClearDues = currentUser.role === 'Cashier' || currentUser.role === 'Admin';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in-up">
      {/* Table Header / Filters */}
      <div className="p-5 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">RPTAR Property Masterlist</h2>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-semibold rounded-full text-xs">
              {filteredProperties.length} of {properties.length} Accounts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Real Property Tax Accounts & Delinquency Register</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Barangay Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <select
              value={selectedBarangay}
              onChange={(e) => { setSelectedBarangay(e.target.value); setCurrentPage(1); }}
              className="block w-full sm:w-40 pl-8 pr-4 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All">All Barangays</option>
              {BARANGAYS.map(brgy => (
                <option key={brgy} value={brgy}>{brgy}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
            className="block w-full sm:w-32 px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="CLEARED">Cleared</option>
            <option value="PARTIAL">Partial (Current)</option>
            <option value="DELINQUENT">Delinquent</option>
          </select>

          {/* Search Bar */}
          <div className="relative flex-grow sm:w-56">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-8 pr-4 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Search TD, Owner, PIN..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {onOpenBulkModal && (
            <button
              onClick={onOpenBulkModal}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-300 transition-all active:scale-95 whitespace-nowrap"
              title="Bulk CSV / Excel Masterlist Import & Export"
            >
              <FileSpreadsheet size={15} className="text-blue-600" />
              Bulk CSV / Excel
            </button>
          )}

          {canEdit && (
            <button
              onClick={onAddProperty}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
            >
              <Plus size={16} />
              Add Property
            </button>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto overflow-y-visible">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-100/75">
            <tr>
              <th scope="col" className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider w-16">Action</th>
              <th scope="col" className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">ARP / TD Number</th>
              <th scope="col" className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Owner's Name</th>
              <th scope="col" className="px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Barangay & Class</th>
              <th scope="col" className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assessed Value</th>
              <th scope="col" className="px-5 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payment Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {paginatedProperties.length > 0 ? paginatedProperties.map((property) => {
              const debt = property.totalDebt !== undefined ? property.totalDebt : calculateTaxLiability(property).grandTotal;
              const status = property.status || (debt === 0 ? 'CLEARED' : 'DELINQUENT');

              return (
                <tr key={property.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-5 py-3.5 whitespace-nowrap relative">
                    <button
                      onClick={() => setOpenDropdownId(openDropdownId === property.id ? null : property.id)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {openDropdownId === property.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenDropdownId(null)}
                        />
                        <div className="absolute left-6 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 animate-in zoom-in-95 duration-100">
                          <button
                            onClick={() => { onSelectProperty(property); setOpenDropdownId(null); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <CreditCard size={14} className="text-blue-600" />
                            {canClearDues ? 'Inspect & Clear Dues' : 'View Statement of Account'}
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => { onEditProperty(property); setOpenDropdownId(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Edit3 size={14} className="text-slate-500" /> Update RPTAR
                            </button>
                          )}

                          {onViewAudit && (
                            <button
                              onClick={() => { onViewAudit(property); setOpenDropdownId(null); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <History size={14} className="text-blue-500" /> View Revision Trail
                            </button>
                          )}

                          {canDelete && (
                            <>
                              <div className="h-px bg-slate-100 my-1" />
                              <button
                                onClick={() => { onDeleteProperty(property.id); setOpenDropdownId(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 size={14} /> Delete Record
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800 font-mono">{property.tdNumber}</span>
                      {property.isShellRecord && (
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                          Shell
                        </span>
                      )}
                    </div>
                    {property.pin && (
                      <p className="text-[10px] text-slate-400 font-mono">PIN: {property.pin}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-800 font-semibold uppercase">
                    {property.ownerName}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{property.barangay}</p>
                    <p className="text-[11px] text-slate-400">{property.propertyClass}</p>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-700 text-right font-mono font-medium">
                    ₱{property.assessedValue.toLocaleString()}
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-right">
                    {status === 'CLEARED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1  text-emerald-700 text-[11px] font-bold rounded-lg">
                        Cleared (2026)
                      </span>
                    ) : status === 'PARTIAL' ? (
                      <div className="inline-flex flex-col items-end">
                        <span className="text-xs font-bold text-amber-600 font-mono">
                          ₱{debt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-amber-700 px-1.5 py-0.2 rounded font-medium">
                          Current Year Partial
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex flex-col items-end">
                        <span className="text-xs font-bold text-rose-600 font-mono">
                          ₱{debt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-rose-700 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                          Delinquent
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs italic">
                  No property records found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer / "Next List" Navigation */}
      <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div>
          Showing <span className="font-bold text-slate-800">{filteredProperties.length > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-bold text-slate-800">
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredProperties.length)}
          </span>{' '}
          of <span className="font-bold text-slate-800">{filteredProperties.length}</span> properties
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
          >
            Next List
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardTable;