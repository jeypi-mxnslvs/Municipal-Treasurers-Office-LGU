import React from 'react';
import { DashboardStatsData } from '../types';
import { AlertTriangle, CheckCircle2, FileText, Landmark } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface DashboardStatsProps {
  stats: DashboardStatsData | null;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="space-y-6 mb-6">
      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Collected
              </p>
              <p className="text-xl font-bold text-slate-800">
                ₱{stats.totalCollected.toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">
                Today: ₱{stats.todayCollected.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Delinquent Debt */}
        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Delinquent Arrears
              </p>
              <p className="text-xl font-bold text-rose-600">
                ₱{stats.totalDelinquentDebt.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Across {stats.delinquentCount} accounts
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Collection Efficiency / Cleared Rate */}
        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Collection Efficiency
              </p>
              <p className="text-xl font-bold text-slate-800">
                {stats.collectionEfficiency}%
              </p>
              <p className="text-xs text-blue-600 font-medium mt-0.5">
                {stats.clearedCount} of {stats.totalProperties} accounts cleared
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Shell Records for Assessor */}
        <Card className="rounded-2xl border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pending Shell Records
              </p>
              <p className="text-xl font-bold text-slate-800">
                {stats.shellRecordsCount}
              </p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                Require Assessor Appraisal
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Collection Trend Chart */}
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">
                Revenue Collection & Target Performance
              </h3>
              <p className="text-xs text-slate-400">
                Monthly breakdown with Q1 & Q2 tax deadline spikes
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-blue-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span> Actual Collections
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block"></span> Target
              </span>
            </div>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `₱${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: number | string | Array<number | string>) => [
                    `₱${Number(value).toLocaleString()}`,
                    '',
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="collections" fill="#2563eb" radius={[6, 6, 0, 0]} name="Collected" />
                <Bar dataKey="target" fill="#cbd5e1" radius={[6, 6, 0, 0]} name="Target" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardStats;
