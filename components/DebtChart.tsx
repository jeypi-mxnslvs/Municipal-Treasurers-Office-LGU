import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TaxYearRecord } from '../types';

interface DebtChartProps {
  records: TaxYearRecord[];
}

const DebtChart: React.FC<DebtChartProps> = ({ records }) => {
  if (records.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[300px]">
      <h3 className="text-slate-800 font-bold text-sm mb-4">Liability Composition</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={records}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{fontSize: 12}} stroke="#64748b" />
          <YAxis tick={{fontSize: 12}} stroke="#64748b" />
          <Tooltip 
            cursor={{fill: '#f1f5f9'}}
            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
          />
          <Legend wrapperStyle={{fontSize: '12px', paddingTop: '10px'}} />
          <Bar dataKey="baseTax" name="Basic Tax" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
          <Bar dataKey="penaltyAmount" name="Penalty" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DebtChart;