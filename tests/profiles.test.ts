import { describe, it, expect } from 'vitest';
import { inferProfile } from '../src/lib/profiles.ts';

describe('inferProfile', () => {
  it('returns es (default) for a filename with no language hint', () => {
    expect(inferProfile('speaker_001.seglst')).toBe('es');
  });

  it('returns es for empty string', () => {
    expect(inferProfile('')).toBe('es');
  });

  it('NV_ES → es', () => {
    expect(inferProfile('NV_ES_session_001.seglst')).toBe('es');
  });

  it('NV_EN → en', () => {
    expect(inferProfile('NV_EN_session_001.seglst')).toBe('en');
  });

  it('NV_PT → pt', () => {
    expect(inferProfile('NV_PT_session_001.seglst')).toBe('pt');
  });

  it('NV_DE → de', () => {
    expect(inferProfile('NV_DE_session_001.seglst')).toBe('de');
  });

  it('NV_FR → fr', () => {
    expect(inferProfile('NV_FR_session_001.seglst')).toBe('fr');
  });

  it('NV_IT → it', () => {
    expect(inferProfile('NV_IT_session_001.seglst')).toBe('it');
  });

  it('unknown language code falls back to es', () => {
    expect(inferProfile('NV_ZZ_session_001.seglst')).toBe('es');
  });

  it('accepts hyphen separator: NV-EN-session → en', () => {
    expect(inferProfile('NV-EN-session.seglst')).toBe('en');
  });

  it('case-insensitive match: nv_en_foo → en', () => {
    expect(inferProfile('nv_en_foo.seglst')).toBe('en');
  });
});
