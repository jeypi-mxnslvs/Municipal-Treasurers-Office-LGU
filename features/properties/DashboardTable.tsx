import React, { useState } from 'react';
import { Property, User } from '@/types';
import { BARANGAYS } from '@/constants';
import { calculateTaxLiability } from '@/utils/taxLogic';
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

const ITEMS_PER_PAGE = 5;

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
  const [selectedBarangay, setSelectedBarangay] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProperties = properties.filter((p) => {
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
  const paginatedProperties = filteredProperties.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

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
            <Badge variant="secondary" className="font-semibold text-xs text-blue-700 bg-blue-100">
              {filteredProperties.length} of {properties.length} Accounts
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
              className="flex h-9 w-full sm:w-40 rounded-md border border-input bg-white pl-8 pr-4 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium text-slate-800"
            >
              <option value="All">All Barangays</option>
              {BARANGAYS.map((brgy) => (
                <option key={brgy} value={brgy}>
                  {brgy}
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
              <FileSpreadsheet size={15} className="text-blue-600" />
              Bulk CSV / Excel
            </Button>
          )}

          {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={onAddProperty}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1.5 shadow-sm whitespace-nowrap text-xs"
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
          <TableHeader className="bg-slate-100/75">
            <TableRow>
              <TableHead className="w-16">Action</TableHead>
              <TableHead>ARP / TD Number</TableHead>
              <TableHead>Owner's Name</TableHead>
              <TableHead>Barangay & Class</TableHead>
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
                const status = property.status || (debt === 0 ? 'CLEARED' : 'DELINQUENT');

                return (
                  <TableRow key={property.id} className="hover:bg-blue-50/40">
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
                            className="text-slate-700 hover:text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                          >
                            <CreditCard size={14} className="text-blue-600 mr-2" />
                            {canClearDues
                              ? 'Inspect & Clear Dues'
                              : 'View Statement of Account'}
                          </DropdownMenuItem>

                          {canEdit && (
                            <DropdownMenuItem
                              onClick={() => onEditProperty(property)}
                              className="text-slate-700 hover:text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                            >
                              <Edit3 size={14} className="text-slate-500 mr-2" />
                              Update RPTAR
                            </DropdownMenuItem>
                          )}

                          {onViewAudit && (
                            <DropdownMenuItem
                              onClick={() => onViewAudit(property)}
                              className="text-slate-700 hover:text-blue-600 focus:text-blue-600 focus:bg-blue-50"
                            >
                              <History size={14} className="text-blue-500 mr-2" />
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 font-mono">
                          {property.tdNumber}
                        </span>
                        {property.isShellRecord && (
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                            Shell
                          </Badge>
                        )}
                      </div>
                      {property.pin && (
                        <p className="text-[10px] text-slate-400 font-mono">PIN: {property.pin}</p>
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
        <div>
          Showing{' '}
          <span className="font-bold text-slate-800">
            {filteredProperties.length > 0 ? startIndex + 1 : 0}
          </span>{' '}
          to{' '}
          <span className="font-bold text-slate-800">
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredProperties.length)}
          </span>{' '}
          of <span className="font-bold text-slate-800">{filteredProperties.length}</span> properties
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
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-1 shadow-xs"
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