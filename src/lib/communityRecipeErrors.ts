export type CommunityServiceErrorCode =
  | 'COMMUNITY_NOT_CONFIGURED'
  | 'COMMUNITY_SCHEMA_MISSING'
  | 'COMMUNITY_ACCESS_DENIED'
  | 'COMMUNITY_UNAVAILABLE';

export function isMissingCommunityColumn(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === '42703' || code === 'PGRST204';
}

export function communityServiceError(error: unknown): { code: CommunityServiceErrorCode; error: string } {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'COMMUNITY_NOT_CONFIGURED') {
    return { code, error: 'Community service is not configured' };
  }
  if (['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'].includes(code || '')) {
    return { code: 'COMMUNITY_SCHEMA_MISSING', error: 'Community database setup is required' };
  }
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST302') {
    return { code: 'COMMUNITY_ACCESS_DENIED', error: 'Community database access needs attention' };
  }
  return { code: 'COMMUNITY_UNAVAILABLE', error: 'Community service is temporarily unavailable' };
}
