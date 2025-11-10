import { ReportsRepository } from './repos.ts';
import { validateReason, validateIntId } from './validators.ts';
import { createHttpError } from './errors.ts';

export interface ReportsDeps {
  reportsRepo: ReportsRepository;
  currentUserId: string;
}

export interface ReportPayload {
  submissionId?: string;
  reason?: string;
}

export const handleReportCreate = async (deps: ReportsDeps, payload: ReportPayload) => {
  if (!payload.submissionId) {
    throw createHttpError(400, 'submissionId is required');
  }

  const submissionId = validateIntId(payload.submissionId, 'submissionId');
  const reason = validateReason(payload.reason);

  await deps.reportsRepo.createReport({
    submissionId,
    reporterId: deps.currentUserId,
    reason,
  });

  return { ok: true };
};
