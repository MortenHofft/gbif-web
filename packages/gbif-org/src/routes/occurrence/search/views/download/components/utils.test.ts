import { describe, expect, it } from 'vitest';
import {
  getEstimatedSizeInBytes,
  getSequenceAvailability,
  requiresSequences,
  supportsExtensions,
  withSequenceFilter,
} from './utils';

describe('requiresSequences', () => {
  it('is true only for the sequence-only formats', () => {
    expect(requiresSequences('FASTA_ARCHIVE')).toBe(true);
    expect(requiresSequences('DWCA')).toBe(false);
    expect(requiresSequences('SIMPLE_CSV')).toBe(false);
    expect(requiresSequences(undefined)).toBe(false);
  });
});

describe('supportsExtensions', () => {
  it('covers both Darwin Core based archives', () => {
    expect(supportsExtensions('DWCA')).toBe(true);
    expect(supportsExtensions('FASTA_ARCHIVE')).toBe(true);
    expect(supportsExtensions('SIMPLE_CSV')).toBe(false);
    expect(supportsExtensions('SQL_CUBE')).toBe(false);
    expect(supportsExtensions(undefined)).toBe(false);
  });
});

describe('withSequenceFilter', () => {
  it('is just the sequence restriction when there is no predicate', () => {
    expect(withSequenceFilter(undefined)).toEqual({
      type: 'isNotNull',
      key: 'nucleotideSequence.sequence',
    });
  });

  it('ands the sequence restriction onto an existing predicate', () => {
    const predicate = { type: 'equals', key: 'country', value: 'DK' };
    expect(withSequenceFilter(predicate)).toEqual({
      type: 'and',
      predicates: [predicate, { type: 'isNotNull', key: 'nucleotideSequence.sequence' }],
    });
  });
});

describe('getSequenceAvailability', () => {
  it('reports loading before the counts are known', () => {
    expect(getSequenceAvailability({ totalRecords: 10, loading: true })).toBe('loading');
  });

  it('reports unknown when the sequenced count is missing', () => {
    expect(getSequenceAvailability({ totalRecords: 10 })).toBe('unknown');
  });

  it('reports none when the search holds no sequences', () => {
    expect(getSequenceAvailability({ totalRecords: 10, sequencedRecords: 0 })).toBe('none');
  });

  it('reports partial when only a subset is sequenced', () => {
    expect(getSequenceAvailability({ totalRecords: 10, sequencedRecords: 4 })).toBe('partial');
  });

  it('reports all when every record is sequenced', () => {
    expect(getSequenceAvailability({ totalRecords: 10, sequencedRecords: 10 })).toBe('all');
  });
});

describe('getEstimatedSizeInBytes', () => {
  it('estimates a FASTA archive above a plain Darwin Core Archive of the same size', () => {
    expect(getEstimatedSizeInBytes('FASTA_ARCHIVE', 1000)).toBeGreaterThan(
      getEstimatedSizeInBytes('DWCA', 1000)
    );
  });

  it('has no estimate for an empty result', () => {
    expect(getEstimatedSizeInBytes('FASTA_ARCHIVE', 0)).toBe(-1);
  });
});
