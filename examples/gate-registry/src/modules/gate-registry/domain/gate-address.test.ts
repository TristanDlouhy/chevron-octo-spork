import { describe, expect, it } from 'vitest';

import { parseGateAddress } from './gate-address.js';

describe('parseGateAddress', () => {
  it('accepts and normalizes a valid address', () => {
    expect(parseGateAddress(' k7qx-204m ')._unsafeUnwrap()).toBe('K7QX-204M');
  });

  it.each(['', 'K7QX204M', 'K7QX-204', 'K7QX-204M-1', 'K7Q!-204M'])('rejects %j', (raw) => {
    expect(parseGateAddress(raw)._unsafeUnwrapErr()).toEqual({ type: 'InvalidGateAddress', raw });
  });
});
