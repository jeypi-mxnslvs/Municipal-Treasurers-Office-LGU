import React from 'react';
import { DashboardStatsData } from '@/types';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface DashboardStatsProps {
  stats: DashboardStatsData | null;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="space-y-6 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Properties</p>
              <p className="text-xl font-bold text-slate-800">{stats.totalProperties.toLocaleString()}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Assessment masterlist</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delinquent Arrears</p>
              <p className="text-xl font-bold text-rose-600">{stats.totalDelinquentDebt === null ? '—' : `₱${stats.totalDelinquentDebt.toLocaleString()}`}</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">{stats.delinquentCount === null ? 'Exact statutory aggregate pending' : `Across ${stats.delinquentCount} accounts`}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clearance Eligible</p>
              <p className="text-xl font-bold text-slate-800">{stats.clearedCount === null ? '—' : stats.clearedCount.toLocaleString()}</p>
              <p className="text-xs text-emerald-700 font-medium mt-0.5">Based on verified records</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Shell Records</p>
              <p className="text-xl font-bold text-slate-800">{stats.shellRecordsCount}</p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">Require assessor appraisal</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardStats;
