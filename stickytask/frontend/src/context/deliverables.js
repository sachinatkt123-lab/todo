/**
 * Step 6 — AI Deliverable & Diff Models.
 *
 * Every task carries an `aiDeliverable` object: a realistic multi-line
 * "Before vs. After" artifact the autonomous agent produced (or would
 * produce) for that task, plus tool-call telemetry, confidence score and a
 * risk tier used by the merge gate in the AI Diff Engine.
 *
 * Shape:
 * {
 *   artifactType: 'code-patch' | 'outbound-email' | 'sql-migration' | 'security-policy' | 'market-matrix',
 *   targetFileOrChannel: string,
 *   summary: string,
 *   confidenceScore: number,
 *   riskTier: 'Green (Autonomous)' | 'Amber (Soft Review)' | 'Red (Strict Gate)',
 *   beforeContent: string[],
 *   afterContent: string[],
 *   toolCalls: string[],
 *   mergedAt?: string | null,
 * }
 */

export const DELIVERABLE_TEMPLATES = {
  ENG: {
    artifactType: 'code-patch',
    summary: 'Added exponential backoff with full jitter & 150ms heartbeat ACK',
    confidenceScore: 98,
    riskTier: 'Amber (Soft Review)',
    beforeContent: [
      'socket.on("close", () => {',
      '  // bare retry — races the pending sync queue on wake-from-sleep',
      '  setTimeout(connect, 1000);',
      '});',
    ],
    afterContent: [
      'socket.on("close", async (ev) => {',
      '  const delay = Math.min(30_000, 250 * 2 ** attempt) * (0.8 + Math.random() * 0.4);',
      '  await replayDeltas(lastEventId); // re-emit missed board deltas',
      '  scheduleReconnect(delay, { heartbeatMs: 150, ackTimeoutMs: 450 });',
      '});',
    ],
    toolCalls: ['read_file(ws_client.ts)', 'run_vitest(ws_reconnect.spec.ts)', 'stage_git_diff()'],
  },
  OPS: {
    artifactType: 'outbound-email',
    summary: 'Drafted enterprise onboarding kickoff email + Slack broadcast',
    confidenceScore: 91,
    riskTier: 'Green (Autonomous)',
    beforeContent: [
      'Subject: (none — manual outreach not started)',
      'Body: —',
    ],
    afterContent: [
      'Subject: Acme Corp × StickyTask — Enterprise Onboarding Kickoff',
      'Hi Adithya, your workspace sprint-14.acme.io is provisioned.',
      'Next step: approve the SSO gate below (single human touchpoint).',
      '[SSO Approval Link] · valid 24h · role=admin required',
    ],
    toolCalls: ['read_crm(acme_corp)', 'provision_workspace(sprint-14)', 'draft_smtp_template(onboard_kickoff)'],
  },
  SEC: {
    artifactType: 'security-policy',
    summary: 'Policy-as-code guardrail blocking red-tier verbs without fresh admin token',
    confidenceScore: 87,
    riskTier: 'Red (Strict Gate)',
    beforeContent: [
      'red_tier:',
      '  - deploy.production',
      '  # TODO: enforcement middleware not yet wired',
    ],
    afterContent: [
      'red_tier:',
      '  - deploy.production',
      '  - db.schema.migrate',
      'requires: role=admin && approval_token=fresh(5m)',
      'on_deny: audit_log(severity=critical) && notify(#sec-oncall)',
    ],
    toolCalls: ['scan_mutating_endpoints()', 'write_policy(policy_tiers.yaml)', 'run_semgrep(sec/agent_guardrails)'],
  },
  GTM: {
    artifactType: 'market-matrix',
    summary: 'Normalized Q4 competitor pricing matrix across 14 sources',
    confidenceScore: 94,
    riskTier: 'Green (Autonomous)',
    beforeContent: [
      'Vendor | Seat Price | Usage Cap | Enterprise Floor',
      '(empty — crawl not run)',
    ],
    afterContent: [
      'Vendor     | Seat/mo | Usage Cap  | Ent. Floor',
      'Linear     | $8      | unlimited  | custom',
      'Height     | $6      | 10k events | $12k/yr',
      'StickyTask | $7      | unlimited  | $9k/yr  ← us',
    ],
    toolCalls: ['crawl_pricing_pages(14)', 'normalize_matrix()', 'cite_snapshots(archive://gtm-q4)'],
  },
  PLN: {
    artifactType: 'sql-migration',
    summary: 'Digest pipeline metrics rollup migration + retro snapshot query',
    confidenceScore: 90,
    riskTier: 'Amber (Soft Review)',
    beforeContent: [
      '-- retro digests computed ad-hoc via app-side loops',
      'SELECT * FROM tasks WHERE sprint_id = $1;',
    ],
    afterContent: [
      '-- 0043: materialized digest rollups for retro automation',
      'CREATE MATERIALIZED VIEW sprint_digest_rollup AS',
      '  SELECT sprint_id, count(*) FILTER (WHERE agent_merged) AS ai_merges,',
      '         percentile_cont(0.95) WITHIN GROUP (ORDER BY lead_time_ms) AS p95_lead',
      '  FROM tasks GROUP BY sprint_id;',
      'CREATE UNIQUE INDEX ON sprint_digest_rollup (sprint_id);',
    ],
    toolCalls: ['read_schema(tasks.sql)', 'generate_migration(0043)', 'dry_run_explain_analyze()'],
  },
};

// Per-task overrides layered onto prefix templates for seed realism.
const TASK_OVERRIDES = {
  'ENG-104': { targetFileOrChannel: 'src/network/ws_client.ts' },
  'OPS-202': { targetFileOrChannel: 'Slack #enterprise-onboarding & SMTP' },
  'ENG-105': {
    artifactType: 'sql-migration',
    targetFileOrChannel: 'db/migrations/0042_pgvector.sql',
    summary: 'Migration 0042 — embeddings table + HNSW index (merged)',
    confidenceScore: 96,
    riskTier: 'Amber (Soft Review)',
    beforeContent: [
      '-- no semantic memory surface yet',
      'CREATE TABLE task_search (id serial, tsvector_col tsvector);',
    ],
    afterContent: [
      'CREATE EXTENSION IF NOT EXISTS vector;',
      'CREATE TABLE task_embeddings (',
      '  task_id text PRIMARY KEY REFERENCES tasks(id),',
      "  embedding vector(1536) NOT NULL",
      ');',
      'CREATE INDEX ON task_embeddings USING hnsw (embedding vector_cosine_ops);',
    ],
    toolCalls: ['read_schema(tasks.sql)', 'write_migration(0042)', 'load_test_ann(100k)'],
  },
  'SEC-089': { targetFileOrChannel: 'policy/policy_tiers.yaml + api/guardrails.ts' },
  'GTM-310': { targetFileOrChannel: 'reports/q4-pricing-matrix.md → #gtm-leadership' },
  'ENG-106': {
    targetFileOrChannel: 'src/telemetry/agent_sse_bridge.ts',
    summary: 'Proposed SSE bridge streaming tool calls + token burn (+27 -0)',
    confidenceScore: 93,
    beforeContent: [
      '// operators poll /api/logs every 5s — stale runs, chatty network',
    ],
    afterContent: [
      "export const handler = async (req) => new Response(streamAgentEvents(req.signal), {",
      "  headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },",
      '});',
      '// ring-buffered: tool_call, token_burn, run_state frames @ <250ms p95',
    ],
    toolCalls: ['read_file(api/logs/route.ts)', 'bench_sse_latency()', 'stage_git_diff()'],
  },
  'PLN-011': { targetFileOrChannel: 'db/migrations/0043_digest_rollup.sql' },
};

/**
 * Build the aiDeliverable for any task (seed or newly created). Newly created
 * tasks fall back to a generic code-patch scaffold keyed off their branch.
 */
// Redesign — friendly deliverable templates keyed by team category so new
// everyday tasks get a plain-language "AI did the work" artifact instead of a
// code patch.
export const CATEGORY_DELIVERABLES = {
  Sales: {
    type: 'Email Drafts Ready to Send',
    artifactType: 'outbound-email',
    summary: 'AI wrote personalized follow-up emails with calendar booking links attached.',
    confidenceScore: 95,
    riskTier: 'Green (Autonomous)',
    beforeContent: ['Goal: Follow up with leads', 'Status: Not started'],
    afterContent: [
      'Subject: Quick follow-up & next steps!',
      '',
      'Hi there,',
      'Great having you at our session yesterday. I put together a custom plan for your team—would Tuesday at 3 PM work for a quick 10-min chat?',
      '',
      'Best,',
      'Your team',
    ],
    toolCalls: ['read_crm(contacts)', 'draft_emails(personalized)', 'attach_booking_link()'],
  },
  Marketing: {
    type: 'Content Plan & Scripts',
    artifactType: 'market-matrix',
    summary: 'AI generated daily post topics, hooks, and caption drafts.',
    confidenceScore: 92,
    riskTier: 'Green (Autonomous)',
    beforeContent: ['Need a week of social posts'],
    afterContent: [
      'Mon: Reel — "Stop wasting time on manual tasks" (Hook + Script ready)',
      'Tue: Carousel — 3 ways AI saves 2 hours a day',
      'Wed: Customer story highlight',
      'Thu: Live Q&A announcement',
      'Fri: Weekend productivity tip',
    ],
    toolCalls: ['scan_content_calendar()', 'draft_posts(7 days)', 'suggest_hashtags()'],
  },
  Operations: {
    type: 'Checklist & Bookings Ready',
    artifactType: 'security-policy',
    summary: 'AI prepared the full checklist and drafted the booking requests.',
    confidenceScore: 90,
    riskTier: 'Amber (Soft Review)',
    beforeContent: ['Setup not started'],
    afterContent: [
      '✓ Room booked: Main Boardroom, Friday 12:00–14:00',
      '✓ Catering order drafted for 12 people (menu options attached)',
      '✓ Calendar invites queued for the team',
    ],
    toolCalls: ['check_availability(friday)', 'reserve_room(boardroom)', 'request_catering(12 guests)'],
  },
  Finance: {
    type: 'Summary Report',
    artifactType: 'sql-migration',
    summary: 'AI compiled the expense summary and flagged bills due this Friday.',
    confidenceScore: 89,
    riskTier: 'Amber (Soft Review)',
    beforeContent: ['October bills not reviewed'],
    afterContent: [
      'Total spend this month: $18,420 across 23 vendors',
      'Due this Friday: Acme Hosting ($1,200), Design Studio ($850)',
      'Flagged: 2 duplicate invoices worth reviewing',
    ],
    toolCalls: ['read_invoices(october)', 'categorize_expenses()', 'flag_due_dates(friday)'],
  },
};

export function buildAiDeliverable(task) {
  // Friendly category-based deliverable for everyday business tasks.
  if (task.category && CATEGORY_DELIVERABLES[task.category]) {
    const c = CATEGORY_DELIVERABLES[task.category];
    const override = (task.aiDeliverable && task.aiDeliverable.__seedOverride) || {};
    return {
      type: c.type,
      artifactType: c.artifactType,
      targetFileOrChannel: override.targetFileOrChannel || c.type,
      summary: override.summary || c.summary,
      confidenceScore: override.confidenceScore ?? c.confidenceScore,
      riskTier: override.riskTier || c.riskTier,
      beforeContent: override.beforeContent || c.beforeContent,
      afterContent: override.afterContent || c.afterContent,
      toolCalls: override.toolCalls || c.toolCalls,
      mergedAt: task.agentStatus === 'completed' ? 'approved · archived for the team' : null,
    };
  }
  const prefix = (task.id.split('-')[0] || 'TASK').toUpperCase();
  const base = DELIVERABLE_TEMPLATES[prefix] || DELIVERABLE_TEMPLATES.ENG;
  const override = TASK_OVERRIDES[task.id] || {};
  return {
    type: base.artifactType,
    artifactType: base.artifactType,
    targetFileOrChannel:
      override.targetFileOrChannel || `${task.branch || 'workspace'}/agent-output.${base.artifactType === 'code-patch' ? 'ts' : 'md'}`,
    summary: override.summary || base.summary,
    confidenceScore: override.confidenceScore ?? base.confidenceScore,
    riskTier: override.riskTier || base.riskTier,
    beforeContent: override.beforeContent || base.beforeContent,
    afterContent: override.afterContent || base.afterContent,
    toolCalls: override.toolCalls || base.toolCalls,
    // Completed tasks are already merged; everything else awaits review.
    mergedAt: task.agentStatus === 'completed' ? 'auto-merged · archived to org memory' : null,
  };
}
