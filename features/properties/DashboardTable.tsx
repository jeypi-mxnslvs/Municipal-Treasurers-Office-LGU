import React, { useState, useEffect, useMemo } from 'react';
import { Property, User } from '@/types';
import { BARANGAYS, CURRENT_YEAR } from '@/constants';
import { calculateTaxLiability } from '@/utils/taxLogic';
import {
  sortPropertiesWithManualFirst,
  isManualProperty,
  PropertySortField,
  PropertySortDirection,
} from '@/utils/encoderAttribution';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  MoreVertical,
  Plus,
  Trash2,
  CreditCard,
  Edit3,
  Filter,
  ChevronLeft,
  ChevronRight,
  History,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';

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

const DEFAULT_PAGE_SIZE = 25;

const getPropertyStatus = (property: Property): 'CLEARED' | 'PARTIAL' | 'DELINQUENT' => {
  if (property.status) return property.status;
  const lastPaid = Number(property.lastPaidYear) || 0;
  const lastQuarter = property.lastPaidQuarter !== undefined && property.lastPaidQuarter !== null
    ? Number(property.lastPaidQuarter)
    : 4;

  if (lastPaid > CURRENT_YEAR || (lastPaid === CURRENT_YEAR && lastQuarter >= 4) || property.totalDebt === 0) {
    return 'CLEARED';
  }
  if (lastPaid === CURRENT_YEAR && lastQuarter < 4) {
    return 'PARTIAL';
  }
  if (lastPaid === CURRENT_YEAR - 1) {
    return 'PARTIAL';
  }
  return 'DELINQUENT';
};

const DashboardTable: React.FC<DashboardTableProps> = ({
  properties,
  currentUser,
  onSelectProperty,
  onAddProperty,
  onEditProperty,
  onDeleteProperty,
  onViewAudit,
  onOpenBulkModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortField, setSortField] = useState<PropertySortField>('ownerName');
  const [sortDirection, setSortDirection] = useState<PropertySortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const handleSort = (field: PropertySortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (field: PropertySortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-emerald-700 font-bold" />
    ) : (
      <ArrowDown className="h-3 w-3 text-emerald-700 font-bold" />
    );
  };

  // 300ms search input debounce to prevent UI freezes on large parcel masterlists
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredProperties = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const matched = properties.filter((p) => {
      const matchesSearch =
        !term ||
        p.ownerName.toLowerCase().includes(term) ||
        p.tdNumber.toLowerCase().includes(term) ||
        (p.pin && p.pin.toLowerCase().includes(term)) ||
        (p.encoderLabel && p.encoderLabel.toLowerCase().includes(term));

      const matchesBarangay =
        selectedBarangay === 'All' || p.barangay === selectedBarangay;

      const propertyStatus = getPropertyStatus(p);
      const matchesStatus =
        selectedStatus === 'All' || propertyStatus === selectedStatus;

      return matchesSearch && matchesBarangay && matchesStatus;
    });

    return sortPropertiesWithManualFirst(matched, {
      field: sortField,
      direction: sortDirection,
    });
  }, [properties, debouncedSearch, selectedBarangay, selectedStatus, sortField, sortDirection]);

  // Pagination Math
  const totalPages = Math.ceil(filteredProperties.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProperties = useMemo(() => {
    return filteredProperties.slice(startIndex, startIndex + pageSize);
  }, [filteredProperties, startIndex, pageSize]);

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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">RPTAR Property Masterlist</h2>
            <Badge variant="secondary" className="font-semibold text-xs text-emerald-800 bg-emerald-100/90 border border-emerald-200/70">
              {filteredProperties.length} of {properties.length} Accounts
            </Badge>
            <Badge
              variant="outline"
              className="text-xs font-normal text-slate-600 border-slate-300 hidden sm:inline-flex items-center gap-1 bg-white/70"
            >
              Sorted:{' '}
              <span className="font-semibold text-slate-800">
                {sortField === 'ownerName'
                  ? "Owner's Name"
                  : sortField === 'tdNumber'
                  ? 'TD Number'
                  : 'Barangay'}
              </span>
              <span className="text-emerald-700 font-semibold text-[10px]">
                ({sortDirection === 'asc' ? 'A–Z' : 'Z–A'})
              </span>
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real Property Tax Accounts & Delinquency Register
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
          {/* Barangay Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <select
              value={selectedBarangay}
              onChange={(e) => {
                setSelectedBarangay(e.target.value);
                setCurrentPage(1);
              }}
              className="flex h-9 w-full sm:w-48 rounded-md border border-input bg-white pl-8 pr-4 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium text-slate-800"
            >
              <option value="All">All Barangays</option>
              {BARANGAYS.map((brgy, idx) => (
                <option key={brgy} value={brgy}>
                  {idx + 1}. {brgy}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="flex h-9 w-full sm:w-32 rounded-md border border-input bg-white px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium text-slate-800"
          >
            <option value="All">All Statuses</option>
            <option value="CLEARED">Cleared</option>
            <option value="PARTIAL">Partial (Current)</option>
            <option value="DELINQUENT">Delinquent</option>
          </select>

          {/* Search Bar */}
          <div className="relative flex-1 sm:w-56">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <Input
              type="text"
              className="pl-8 text-xs bg-white"
              placeholder="Search TD, Owner, PIN..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {onOpenBulkModal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenBulkModal}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 font-bold gap-1.5 whitespace-nowrap text-xs"
              title="Bulk CSV / Excel Masterlist Import & Export"
            >
              <FileSpreadsheet size={15} className="text-emerald-700" />
              Bulk CSV / Excel
            </Button>
          )}

          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={onAddProperty}
              className="bg-[#064e3b] hover:bg-[#085a44] text-white font-bold gap-1.5 shadow-sm whitespace-nowrap text-xs"
            >
              <Plus size={16} />
              Add Property
            </Button>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto overflow-y-visible flex-1">
        <Table>
          <TableHeader className="bg-slate-100/75 select-none">
            <TableRow>
              <TableHead className="w-16">Action</TableHead>
              <TableHead
                className="cursor-pointer group hover:text-slate-900 transition-colors"
                onClick={() => handleSort('tdNumber')}
                title="Click to sort by ARP / TD Number"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span>ARP / TD Number</span>
                  {renderSortIcon('tdNumber')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer group hover:text-slate-900 transition-colors"
                onClick={() => handleSort('ownerName')}
                title="Click to sort by Owner's Name (A–Z / Z–A)"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span>Owner's Name</span>
                  {renderSortIcon('ownerName')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer group hover:text-slate-900 transition-colors"
                onClick={() => handleSort('barangay')}
                title="Click to sort by Barangay (A–Z / Z–A)"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span>Barangay & Class</span>
                  {renderSortIcon('barangay')}
                </div>
              </TableHead>
              <TableHead className="text-right">Assessed Value</TableHead>
              <TableHead className="text-right">Payment Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white text-xs">
            {paginatedProperties.length > 0 ? (
              paginatedProperties.map((property) => {
                const debt =
                  property.totalDebt !== undefined
                    ? property.totalDebt
                    : calculateTaxLiability(property).grandTotal;
                const status = getPropertyStatus(property);

                return (
                  <TableRow key={property.id} className="hover:bg-emerald-50/30 transition-colors">
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                          >
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-52">
                          <DropdownMenuItem
                            onClick={() => onSelectProperty(property)}
                            className="text-slate-700 hover:text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50"
                          >
                            <CreditCard size={14} className="text-emerald-700 mr-2" />
                            {canClearDues
                              ? 'Inspect & Clear Dues'
                              : 'View Statement of Account'}
                          </DropdownMenuItem>

                          {canEdit && (
                            <DropdownMenuItem
                              onClick={() => onEditProperty(property)}
                              className="text-slate-700 hover:text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50"
                            >
                              <Edit3 size={14} className="text-slate-500 mr-2" />
                              Update RPTAR
                            </DropdownMenuItem>
                          )}

                          {onViewAudit && (
                            <DropdownMenuItem
                              onClick={() => onViewAudit(property)}
                              className="text-slate-700 hover:text-emerald-700 focus:text-emerald-700 focus:bg-emerald-50"
                            >
                              <History size={14} className="text-emerald-600 mr-2" />
                              View Revision Trail
                            </DropdownMenuItem>
                          )}

                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onDeleteProperty(property.id)}
                                className="text-rose-600 hover:text-rose-700 focus:text-rose-700 focus:bg-rose-50"
                              >
                                <Trash2 size={14} className="text-rose-600 mr-2" />
                                Delete Record
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 font-mono">
                          {property.tdNumber}
                        </span>
                        {isManualProperty(property) && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                            title="Manually Encoded Record — Priority #1 in Masterlist"
                          >
                            Manual #1
                          </Badge>
                        )}
                        {property.isShellRecord && (
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                            Shell
                          </Badge>
                        )}
                      </div>
                      {property.pin && (
                        <p className="text-[10px] text-slate-400 font-mono">PIN: {property.pin}</p>
                      )}
                      {property.encoderLabel && (
                        <p
                          className="text-[10px] text-slate-500 font-sans truncate max-w-[200px] mt-0.5"
                          title={`Provenance Trail: ${property.encoderLabel}`}
                        >
                          <span className="text-slate-400">By:</span>{' '}
                          <span className="font-medium text-slate-700">{property.encoderLabel}</span>
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800 uppercase">
                      {property.ownerName}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <p className="font-medium text-slate-800">{property.barangay}</p>
                      <p className="text-[11px] text-slate-400">{property.propertyClass}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-slate-700">
                      ₱{property.assessedValue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'CLEARED' ? (
                        <Badge variant="success" className="text-[11px] font-bold">
                          Cleared (2026)
                        </Badge>
                      ) : status === 'PARTIAL' ? (
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <span className="text-xs font-bold text-amber-600 font-mono">
                            ₱{debt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <Badge variant="warning" className="text-[10px] py-0">
                            Current Year Partial
                          </Badge>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-end gap-0.5">
                          <span className="text-xs font-bold text-rose-600 font-mono">
                            ₱{debt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <Badge variant="destructive" className="text-[10px] py-0">
                            Delinquent
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-slate-400 text-xs italic">
                  No property records found matching your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            Showing{' '}
            <span className="font-bold text-slate-800">
              {filteredProperties.length > 0 ? startIndex + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-bold text-slate-800">
              {Math.min(startIndex + pageSize, filteredProperties.length)}
            </span>{' '}
            of <span className="font-bold text-slate-800">{filteredProperties.length}</span> properties
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-[11px] text-slate-400">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="gap-1 font-semibold"
          >
            <ChevronLeft size={14} />
            Previous
          </Button>

          <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            type="button"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="bg-[#064e3b] hover:bg-[#085a44] text-white font-semibold gap-1 shadow-xs"
          >
            Next List
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardTable;