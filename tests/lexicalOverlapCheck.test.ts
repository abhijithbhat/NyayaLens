import { describe, it, expect } from 'vitest';
import { lexicalOverlapCheck } from '@/lib/verify';

describe('lexicalOverlapCheck (Gate 1 Verification)', () => {
  const sampleSourceText = `The Tenant shall pay a monthly rent of Rs. 38,000 (Rupees Thirty Eight Thousand) on or before the 5th day of each English calendar month. In case of delayed payment beyond the 10th of the month, a late fee of Rs. 500 per week shall be levied. The Tenant has deposited a refundable interest-free security deposit of Rs. 1,50,000 with the Landlord, to be refunded within 30 days of vacating the premises. This agreement shall remain in force for a period of 11 months with a lock-in period of 6 months. Either party may terminate this agreement by providing two months written notice.`;

  // 1. Empty/Missing inputs
  it('rejects empty claim or empty source text', () => {
    expect(lexicalOverlapCheck('', sampleSourceText)).toBe(false);
    expect(lexicalOverlapCheck('The monthly rent is 38,000', '')).toBe(false);
  });

  // 2. Grounded claim passes with high lexical overlap
  it('correctly passes a grounded claim that matches source numbers and terms', () => {
    const groundedClaim = 'The tenant is required to pay a monthly rent of 38,000 before the 5th day of each month.';
    expect(lexicalOverlapCheck(groundedClaim, sampleSourceText)).toBe(true);
  });

  // 3. Invented financial amount rejection
  it('correctly rejects a claim containing an invented financial amount not in the source', () => {
    const hallucinatedClaim = 'The tenant must pay a security deposit of 2,00,000 to the landlord.';
    expect(lexicalOverlapCheck(hallucinatedClaim, sampleSourceText)).toBe(false);
  });

  // 4. Invented penalty amount rejection
  it('correctly rejects a claim with an invented late penalty fee', () => {
    const fakePenaltyClaim = 'Delayed payment beyond the 10th incurs a penalty of 5000 per week.';
    expect(lexicalOverlapCheck(fakePenaltyClaim, sampleSourceText)).toBe(false);
  });

  // 5. Invented timeframe number rejection
  it('correctly rejects a claim with an invented timeframe (e.g. 15 months instead of 11 months)', () => {
    const fakeDurationClaim = 'This rental agreement has a total duration of 15 months.';
    expect(lexicalOverlapCheck(fakeDurationClaim, sampleSourceText)).toBe(false);
  });

  // 6. Number comma formatting normalization
  it('normalizes numbers with and without commas correctly', () => {
    const claimWithoutCommas = 'The refundable security deposit is 150000.';
    expect(lexicalOverlapCheck(claimWithoutCommas, sampleSourceText)).toBe(true);
  });

  // 7. Small integer written representation equivalence (1-12)
  it('recognizes written representations for small numbers (e.g., "2" matches "two")', () => {
    const noticeClaim = 'Termination requires 2 months written notice from either party.';
    expect(lexicalOverlapCheck(noticeClaim, sampleSourceText)).toBe(true);
  });

  // 8. Rejects ungrounded Latin claim with insufficient term overlap (<35%)
  it('rejects an ungrounded claim where substantive words do not appear in the source', () => {
    const irrelevantClaim = 'The commercial aerospace contractor shall deliver telemetry hardware modules.';
    expect(lexicalOverlapCheck(irrelevantClaim, sampleSourceText)).toBe(false);
  });

  // 9. Devanagari (Hindi) script bypasses Latin overlap when numbers match
  it('bypasses Latin token-overlap for Devanagari (Hindi) script when numbers are grounded', () => {
    const hindiGroundedClaim = 'मासिक किराया 38,000 रुपये है जो महीने की 5 तारीख तक देय है।';
    expect(lexicalOverlapCheck(hindiGroundedClaim, sampleSourceText)).toBe(true);
  });

  // 10. Devanagari (Hindi) script strictly rejects invented numbers
  it('strictly rejects Devanagari (Hindi) claims if they contain invented numbers', () => {
    const hindiFakeClaim = 'सुरक्षा जमा राशि 99,000 रुपये है।';
    expect(lexicalOverlapCheck(hindiFakeClaim, sampleSourceText)).toBe(false);
  });

  // 11. Kannada script bypasses Latin overlap when numbers match
  it('bypasses Latin token-overlap for Kannada script when numbers are grounded', () => {
    const kannadaGroundedClaim = 'ಪ್ರತಿ ತಿಂಗಳ ಬಾಡಿಗೆ 38,000 ರೂಪಾಯಿಗಳನ್ನು 5 ನೇ ತಾರೀಖಿನೊಳಗೆ ಪಾವತಿಸಬೇಕು.';
    expect(lexicalOverlapCheck(kannadaGroundedClaim, sampleSourceText)).toBe(true);
  });

  // 12. Kannada script strictly rejects invented numbers
  it('strictly rejects Kannada claims if they contain invented numbers', () => {
    const kannadaFakeClaim = 'ಭದ್ರತಾ ಠೇವಣಿ ಮೊತ್ತ 80,000 ರೂಪಾಯಿಗಳು.';
    expect(lexicalOverlapCheck(kannadaFakeClaim, sampleSourceText)).toBe(false);
  });
});
