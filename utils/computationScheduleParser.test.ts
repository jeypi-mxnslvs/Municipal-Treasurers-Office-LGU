import { describe, expect, it } from 'vitest';
import { parseComputationSheet } from './computationScheduleParser';

describe('computation schedule parser', () => {
  it('normalizes formula-bar penalty and discount rules without evaluating formulas', () => {
    const result = parseComputationSheet('SEP', {
      K15: '1973-79',
      L15: '(I15*0.01)*7',
      N15: 'L15*0.24',
      P15: 'L15+N15',
      K38: '2027',
      L38: 'I38*0.01',
      N38: 'L38*0.2',
      P38: 'L38-N38',
    });

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        periodLabel: '1973-79',
        startYear: 1973,
        endYear: 1979,
        multiplier: 7,
        baseTaxRate: 0.01,
        adjustment: 'PENALTY',
        adjustmentRate: 0.24,
        operation: 'ADD',
        sourceSheet: 'SEP',
        sourceRow: 15,
      }),
      expect.objectContaining({
        periodLabel: '2027',
        adjustment: 'DISCOUNT',
        adjustmentRate: 0.2,
        operation: 'SUBTRACT',
      }),
    ]);
  });

  it('rejects unsupported or unsafe rate expressions', () => {
    const result = parseComputationSheet('SEP', {
      K15: '1973-79',
      L15: '(I15*0.01)*7',
      N15: 'L15*85',
      P15: 'L15+N15',
    });

    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]).toContain('unsupported computation formula');
  });
});
