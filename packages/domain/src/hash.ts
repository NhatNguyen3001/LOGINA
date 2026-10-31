import { createHash } from 'node:crypto';
import canonicalize from 'canonicalize';

/** RFC 8785 canonical JSON, then SHA-256 hex (05-Backend-Schema section 7). */
export function canonicalHash(value: unknown): string {
  const canonical = canonicalize(value);
  if (canonical === undefined) throw new Error('canonicalHash: value has no JSON form');
  return createHash('sha256').update(canonical).digest('hex');
}
