/* ==========================================================================
   Failure scenario library (SIMULATED).
   Each scenario describes one realistic agent failure end to end: the trace,
   what the investigator finds, the repair the repair-LLM proposes, and the
   checks run when retrying. The mock API instantiates these per customer.
   ========================================================================== */
import type {
  AgentKind,
  DiffLine,
  Evidence,
  FailureCategory,
  RepairStrategy,
  Severity,
  StepKind,
  StepStatus,
} from '../domain/types';

export interface StepSpec {
  kind: StepKind;
  name: string;
  ms: number;
  status?: StepStatus;
  model?: string;
  tokens?: number;
  input: unknown;
  output: unknown;
  error?: string;
}

export interface Scenario {
  key: string;
  agentKind: AgentKind;
  category: FailureCategory;
  severity: Severity;
  title: string;
  taskTitle: string;
  errorMessage: string;
  requiresHuman: boolean;
  steps: StepSpec[];
  failingStep: number; // index into steps
  investigationLog: string[];
  rootCause: { summary: string; confidence: number; evidence: Omit<Evidence, 'stepId'>[]; evidenceSteps: number[]; contributing: string[] };
  proposal: {
    strategy: RepairStrategy;
    title: string;
    rationale: string;
    target: string;
    diff: DiffLine[];
    risk: 'low' | 'medium' | 'high';
    expectedSuccess: number;
  };
  checks: { label: string; detail: string }[];
  /** probability the simulated retry passes all checks */
  passRate: number;
}

const d = (t: DiffLine['t'], s: string): DiffLine => ({ t, s });

export const SCENARIOS: Scenario[] = [
  /* ------------------------------------------------------------------ */
  {
    key: 'invoice-amount-string',
    agentKind: 'invoice',
    category: 'schema_mismatch',
    severity: 'high',
    title: 'ERP rejected invoice: amount sent as formatted string',
    taskTitle: 'Create invoice for PO-48211',
    errorMessage: "422 Unprocessable Entity — body.amount: expected number, received string '1,240.00'",
    requiresHuman: false,
    steps: [
      { kind: 'plan', name: 'plan.decompose', ms: 640, model: 'claude-sonnet-5-5', tokens: 812, input: { goal: 'Create invoice for PO-48211' }, output: { steps: ['fetch_po', 'extract_lines', 'create_invoice', 'notify'] } },
      { kind: 'tool', name: 'erp.get_purchase_order', ms: 420, input: { po: 'PO-48211' }, output: { po: 'PO-48211', vendor: 'Acme Freight', currency: 'USD', total: '1,240.00', lines: 3 } },
      { kind: 'llm', name: 'llm.extract_invoice_fields', ms: 1890, model: 'claude-sonnet-5-5', tokens: 2310, input: { fields: ['vendor', 'amount', 'currency', 'due_date'] }, output: { vendor_id: 'V-2201', amount: '1,240.00', currency: 'USD', due_date: '2026-12-02' } },
      { kind: 'tool', name: 'erp.create_invoice', ms: 310, status: 'error', input: { vendor_id: 'V-2201', amount: '1,240.00', currency: 'USD', due_date: '2026-12-02' }, output: { status: 422, error: 'body.amount: expected number' }, error: "422 Unprocessable Entity — body.amount: expected number, received string '1,240.00'" },
      { kind: 'output', name: 'notify.ap_channel', ms: 0, status: 'skipped', input: null, output: null },
    ],
    failingStep: 3,
    investigationLog: [
      'Loaded trace · 5 steps · 3.26 s',
      'Located first failing step: erp.create_invoice (HTTP 422)',
      'Compared payload against ERP tool schema v3.2',
      'Field `amount` is string; schema requires number',
      'Traced value back to llm.extract_invoice_fields output',
      'Source PO returns locale-formatted total "1,240.00"',
      'Searched corrections memory: 2 similar fixes on other agents',
    ],
    rootCause: {
      summary:
        'The extraction step copied the purchase order total verbatim, including the thousands separator, so `amount` reached the ERP as the string "1,240.00" instead of the number 1240.00.',
      confidence: 0.94,
      evidence: [
        { label: 'Schema violation', detail: 'erp.create_invoice requires amount: number (schema v3.2)' },
        { label: 'Value origin', detail: 'llm.extract_invoice_fields output.amount = "1,240.00"' },
        { label: 'Upstream format', detail: 'erp.get_purchase_order returns locale-formatted totals' },
      ],
      evidenceSteps: [3, 2, 1],
      contributing: ['Extraction prompt has no numeric typing rules', 'Tool call made without client-side schema validation'],
    },
    proposal: {
      strategy: 'schema_coercion',
      title: 'Coerce numeric fields and tighten the extraction prompt',
      rationale:
        'Add a typed rule to the extraction prompt and a deterministic coercion step before the ERP call. Coercion handles today\'s payload; the prompt rule prevents recurrence on new vendors.',
      target: 'agents/invoice/extract_fields.prompt · tools/erp.create_invoice',
      diff: [
        d('@', '@@ extract_fields.prompt'),
        d(' ', 'Return a JSON object with vendor_id, amount, currency, due_date.'),
        d('+', 'Rules:'),
        d('+', '- amount MUST be a JSON number with no separators or currency symbols.'),
        d('+', '  e.g. "1,240.00" -> 1240.00'),
        d('@', '@@ tools/erp.create_invoice.pre'),
        d('-', 'return args'),
        d('+', 'args.amount = toNumber(args.amount)  // strips "," and currency symbols'),
        d('+', 'assertSchema(args, ErpInvoiceV32)'),
        d('+', 'return args'),
      ],
      risk: 'low',
      expectedSuccess: 0.96,
    },
    checks: [
      { label: 'Payload matches ERP schema v3.2', detail: 'amount: 1240 (number)' },
      { label: 'Retry erp.create_invoice', detail: '201 Created · INV-90412' },
      { label: 'Amount matches source PO', detail: '1240.00 USD = 1240.00 USD' },
      { label: 'Regression replay (12 past invoices)', detail: '12/12 passed' },
    ],
    passRate: 0.95,
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'support-refund-wrong-tool',
    agentKind: 'support',
    category: 'wrong_tool',
    severity: 'critical',
    title: 'Agent issued a refund when customer only asked for a quote',
    taskTitle: 'Reply to ticket #88213 — "how much would I get back?"',
    errorMessage: 'Guard blocked refund.issue: intent=quote_request, action=irreversible_payment',
    requiresHuman: true,
    steps: [
      { kind: 'retrieval', name: 'kb.search', ms: 380, input: { q: 'refund amount partial month' }, output: { hits: 4, top: 'Refund policy §2.3 — pro-rated refunds' } },
      { kind: 'llm', name: 'llm.classify_intent', ms: 910, model: 'claude-haiku-5-5', tokens: 640, input: { message: 'If I cancel today how much would I get back?' }, output: { intent: 'quote_request', confidence: 0.88 } },
      { kind: 'llm', name: 'llm.select_tool', ms: 1420, model: 'claude-sonnet-5-5', tokens: 1980, input: { intent: 'quote_request', tools: ['refund.quote', 'refund.issue', 'ticket.reply'] }, output: { tool: 'refund.issue', args: { order: 'ORD-55120', amount: 38.4 } } },
      { kind: 'guard', name: 'guard.irreversible_actions', ms: 40, status: 'error', input: { tool: 'refund.issue', intent: 'quote_request' }, output: { blocked: true }, error: 'Guard blocked refund.issue: intent=quote_request, action=irreversible_payment' },
      { kind: 'output', name: 'ticket.reply', ms: 0, status: 'skipped', input: null, output: null },
    ],
    failingStep: 2,
    investigationLog: [
      'Loaded trace · 5 steps · 2.75 s',
      'Guard guard.irreversible_actions blocked step 4',
      'Intent classified correctly as quote_request (0.88)',
      'Tool selection chose refund.issue despite quote intent',
      'Tool descriptions: refund.quote and refund.issue differ by one word',
      'Policy: irreversible payment tools require explicit confirmation',
    ],
    rootCause: {
      summary:
        'Intent was classified correctly, but the tool-selection step picked `refund.issue` over `refund.quote` because both tool descriptions read "Calculate refund for an order". The guard prevented a real payment.',
      confidence: 0.89,
      evidence: [
        { label: 'Correct intent', detail: 'llm.classify_intent → quote_request (0.88)' },
        { label: 'Wrong selection', detail: 'llm.select_tool → refund.issue' },
        { label: 'Ambiguous tool docs', detail: 'Both descriptions start "Calculate refund for an order"' },
      ],
      evidenceSteps: [1, 2, 3],
      contributing: ['No intent → tool allow-list', 'Irreversible tools exposed for read-only intents'],
    },
    proposal: {
      strategy: 'prompt_patch',
      title: 'Disambiguate refund tools and gate them by intent',
      rationale:
        'Rewrite tool descriptions so they are mutually exclusive and only expose irreversible tools when intent is refund_request. Touches payments, so it is routed to a human for approval.',
      target: 'agents/support/tools.yaml · agents/support/select_tool.prompt',
      diff: [
        d('@', '@@ tools.yaml'),
        d('-', '  refund.quote:  "Calculate refund for an order"'),
        d('-', '  refund.issue:  "Calculate refund for an order and pay it"'),
        d('+', '  refund.quote:  "READ-ONLY. Estimate a refund. Never moves money."'),
        d('+', '  refund.issue:  "IRREVERSIBLE. Pays a refund. Only for intent=refund_request."'),
        d('@', '@@ select_tool.prompt'),
        d('+', 'Only choose tools listed for the classified intent:'),
        d('+', '  quote_request  -> [refund.quote, ticket.reply]'),
        d('+', '  refund_request -> [refund.quote, refund.issue, ticket.reply]'),
      ],
      risk: 'medium',
      expectedSuccess: 0.91,
    },
    checks: [
      { label: 'Tool selection replay', detail: 'refund.quote chosen for quote_request' },
      { label: 'Guard did not fire', detail: 'no irreversible action attempted' },
      { label: 'Reply contains quote amount', detail: '$38.40 pro-rated' },
      { label: 'Adversarial set (20 intents)', detail: '20/20 routed correctly' },
    ],
    passRate: 0.9,
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'datasync-timeout',
    agentKind: 'datasync',
    category: 'timeout',
    severity: 'medium',
    title: 'Warehouse query timed out after full-table scan',
    taskTitle: 'Nightly sync: shipments → analytics',
    errorMessage: 'warehouse.query exceeded 30000 ms (statement_timeout)',
    requiresHuman: false,
    steps: [
      { kind: 'plan', name: 'plan.sync_window', ms: 520, model: 'claude-haiku-5-5', tokens: 420, input: { job: 'shipments_nightly' }, output: { window: 'last 24h' } },
      { kind: 'llm', name: 'llm.write_sql', ms: 1640, model: 'claude-sonnet-5-5', tokens: 1720, input: { table: 'shipments', window: 'last 24h' }, output: { sql: 'SELECT * FROM shipments WHERE updated_at::date >= CURRENT_DATE - 1' } },
      { kind: 'tool', name: 'warehouse.query', ms: 30000, status: 'error', input: { sql: 'SELECT * FROM shipments WHERE updated_at::date >= CURRENT_DATE - 1', timeout_ms: 30000 }, output: { rows_scanned: 412000000 }, error: 'warehouse.query exceeded 30000 ms (statement_timeout)' },
      { kind: 'tool', name: 'analytics.upsert', ms: 0, status: 'skipped', input: null, output: null },
    ],
    failingStep: 2,
    investigationLog: [
      'Loaded trace · 4 steps · 32.2 s',
      'warehouse.query hit statement_timeout (30 s)',
      'Query plan: Seq Scan on shipments (412M rows)',
      'Cast `updated_at::date` disables partition pruning',
      'Table is partitioned by updated_at (daily)',
    ],
    rootCause: {
      summary:
        'The generated SQL casts `updated_at` to a date, which prevents partition pruning, so the warehouse scanned all 412M rows instead of yesterday\'s partition.',
      confidence: 0.92,
      evidence: [
        { label: 'Timeout', detail: 'warehouse.query 30 000 ms' },
        { label: 'Full scan', detail: 'rows_scanned = 412 000 000' },
        { label: 'Non-sargable predicate', detail: 'updated_at::date >= CURRENT_DATE - 1' },
      ],
      evidenceSteps: [2, 2, 1],
      contributing: ['SQL prompt lacks partition hints', 'No retry/backoff for transient load'],
    },
    proposal: {
      strategy: 'tool_args',
      title: 'Use a range predicate on the partition key and add backoff',
      rationale: 'Rewrite the predicate to a timestamp range so the planner prunes partitions; add one retry with backoff for transient warehouse load.',
      target: 'agents/datasync/write_sql.prompt · tools/warehouse.query',
      diff: [
        d('@', '@@ write_sql.prompt'),
        d('+', 'Never wrap partition columns (updated_at) in casts or functions.'),
        d('+', 'Use half-open ranges: updated_at >= :start AND updated_at < :end'),
        d('@', '@@ generated SQL'),
        d('-', 'WHERE updated_at::date >= CURRENT_DATE - 1'),
        d('+', "WHERE updated_at >= now() - interval '24 hours' AND updated_at < now()"),
        d('@', '@@ tools/warehouse.query'),
        d('+', 'retry: { attempts: 2, backoff_ms: [2000, 8000] }'),
      ],
      risk: 'low',
      expectedSuccess: 0.97,
    },
    checks: [
      { label: 'Query plan uses partition pruning', detail: '1 of 730 partitions scanned' },
      { label: 'Retry warehouse.query', detail: '1.8 s · 1.12M rows' },
      { label: 'Row count within expected band', detail: '1.12M (7-day avg 1.09M)' },
    ],
    passRate: 0.97,
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'research-ungrounded-id',
    agentKind: 'research',
    category: 'hallucination',
    severity: 'high',
    title: 'Answer cited an order ID that does not exist in retrieved data',
    taskTitle: 'Summarize delayed orders for account Lumen Co.',
    errorMessage: 'Grounding check failed: "ORD-99812" not found in any retrieved document',
    requiresHuman: false,
    steps: [
      { kind: 'retrieval', name: 'orders.search', ms: 610, input: { account: 'Lumen Co.', status: 'delayed' }, output: { hits: ['ORD-99781', 'ORD-99790', 'ORD-99804'] } },
      { kind: 'llm', name: 'llm.summarize', ms: 2440, model: 'claude-sonnet-5-5', tokens: 3120, input: { docs: 3 }, output: { summary: '4 orders delayed: ORD-99781, ORD-99790, ORD-99804, ORD-99812 …' } },
      { kind: 'guard', name: 'guard.grounding', ms: 120, status: 'error', input: { ids: ['ORD-99781', 'ORD-99790', 'ORD-99804', 'ORD-99812'] }, output: { ungrounded: ['ORD-99812'] }, error: 'Grounding check failed: "ORD-99812" not found in any retrieved document' },
      { kind: 'output', name: 'report.publish', ms: 0, status: 'skipped', input: null, output: null },
    ],
    failingStep: 1,
    investigationLog: [
      'Loaded trace · 4 steps · 3.17 s',
      'guard.grounding flagged 1 ungrounded identifier',
      'Retrieved set contains 3 orders; summary lists 4',
      'ORD-99812 follows the numeric pattern of real IDs — likely extrapolated',
      'Summarize prompt asks for "all delayed orders" without restricting to context',
    ],
    rootCause: {
      summary:
        'The summarizer extrapolated a fourth order ID that matches the pattern of the three real ones. The prompt asks for "all delayed orders" but never restricts identifiers to the retrieved context.',
      confidence: 0.87,
      evidence: [
        { label: 'Retrieved IDs', detail: 'ORD-99781, ORD-99790, ORD-99804' },
        { label: 'Fabricated ID', detail: 'ORD-99812 present only in llm.summarize output' },
        { label: 'Guard result', detail: 'guard.grounding ungrounded = 1' },
      ],
      evidenceSteps: [0, 1, 2],
      contributing: ['Prompt implies completeness beyond context', 'No citation requirement'],
    },
    proposal: {
      strategy: 'guardrail',
      title: 'Require citations for identifiers and drop ungrounded ones',
      rationale: 'Ask the model to cite a source doc for each ID and enforce it in a post-processing guard that removes or flags ungrounded IDs before publishing.',
      target: 'agents/research/summarize.prompt · guards/grounding.ts',
      diff: [
        d('@', '@@ summarize.prompt'),
        d('-', 'List all delayed orders for the account.'),
        d('+', 'List ONLY orders present in <context>. Cite each as ORD-xxxxx [doc:N].'),
        d('+', 'If you are unsure whether more exist, say so instead of guessing.'),
        d('@', '@@ guards/grounding.ts'),
        d('-', 'onUngrounded: "fail"'),
        d('+', 'onUngrounded: "strip_and_annotate"'),
      ],
      risk: 'low',
      expectedSuccess: 0.93,
    },
    checks: [
      { label: 'All IDs grounded', detail: '3/3 cited to retrieved docs' },
      { label: 'Summary count matches retrieval', detail: '3 = 3' },
      { label: 'Golden set replay (30 summaries)', detail: '29/30 · 1 borderline' },
    ],
    passRate: 0.88,
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'crm-token-expired',
    agentKind: 'outreach',
    category: 'auth',
    severity: 'medium',
    title: 'CRM update failed with expired OAuth token',
    taskTitle: 'Log call outcome for 14 leads',
    errorMessage: '401 Unauthorized — token expired at 09:14:02Z',
    requiresHuman: false,
    steps: [
      { kind: 'tool', name: 'calls.fetch_outcomes', ms: 540, input: { batch: 'B-7731' }, output: { count: 14 } },
      { kind: 'llm', name: 'llm.map_dispositions', ms: 1210, model: 'claude-haiku-5-5', tokens: 980, input: { count: 14 }, output: { mapped: 14 } },
      { kind: 'tool', name: 'crm.update_contact', ms: 190, status: 'error', input: { contact: 'C-11820', disposition: 'callback' }, output: { status: 401 }, error: '401 Unauthorized — token expired at 09:14:02Z' },
      { kind: 'tool', name: 'crm.update_contact ×13', ms: 0, status: 'skipped', input: null, output: null },
    ],
    failingStep: 2,
    investigationLog: [
      'Loaded trace · 4 steps · 1.94 s',
      'crm.update_contact returned 401',
      'Token issued 09:14:02Z − 3600 s, call at 09:14:07Z',
      'Agent cached token at session start and never refreshed',
    ],
    rootCause: {
      summary: 'The agent cached an OAuth access token at session start. The long-running batch outlived the 1-hour token, and the tool has no refresh-on-401 behaviour.',
      confidence: 0.97,
      evidence: [
        { label: 'HTTP status', detail: '401 Unauthorized' },
        { label: 'Token age', detail: '3 605 s (ttl 3 600 s)' },
      ],
      evidenceSteps: [2, 2],
      contributing: ['No refresh-on-401 in tool wrapper'],
    },
    proposal: {
      strategy: 'retry_policy',
      title: 'Refresh token on 401 and retry once',
      rationale: 'Deterministic fix in the tool wrapper. No prompt change needed.',
      target: 'tools/crm.client.ts',
      diff: [
        d('@', '@@ crm.client.ts'),
        d('+', 'onStatus(401, async (req) => {'),
        d('+', '  await auth.refresh()'),
        d('+', '  return req.retry({ max: 1 })'),
        d('+', '})'),
      ],
      risk: 'low',
      expectedSuccess: 0.99,
    },
    checks: [
      { label: 'Token refreshed', detail: 'new ttl 3 600 s' },
      { label: 'Retry crm.update_contact ×14', detail: '14/14 · 200 OK' },
    ],
    passRate: 0.99,
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'router-loop',
    agentKind: 'order_router',
    category: 'loop',
    severity: 'high',
    title: 'Planner looped on inventory search 14 times',
    taskTitle: 'Route order ORD-61204 to nearest warehouse',
    errorMessage: 'Max iterations (15) reached — repeated identical tool call inventory.search',
    requiresHuman: false,
    steps: [
      { kind: 'plan', name: 'plan.route', ms: 480, model: 'claude-sonnet-5-5', tokens: 690, input: { order: 'ORD-61204' }, output: { next: 'inventory.search' } },
      { kind: 'tool', name: 'inventory.search', ms: 260, input: { sku: 'SKU-2231', near: '94107' }, output: { results: [], note: 'radius_km default 25' } },
      { kind: 'llm', name: 'llm.reflect ×13', ms: 11800, status: 'warning', model: 'claude-sonnet-5-5', tokens: 14200, input: { last: 'no results' }, output: { next: 'inventory.search (same args)' } },
      { kind: 'guard', name: 'guard.max_iterations', ms: 10, status: 'error', input: { iterations: 15 }, output: { halted: true }, error: 'Max iterations (15) reached — repeated identical tool call inventory.search' },
    ],
    failingStep: 2,
    investigationLog: [
      'Loaded trace · 4 steps · 12.6 s · 14 identical calls',
      'inventory.search returned empty with radius_km=25',
      'Reflection step re-issued the same call 13×',
      'Tool supports radius_km up to 500 — never varied',
    ],
    rootCause: {
      summary: 'After an empty search the reflection step retried with identical arguments. It never widened `radius_km`, so every retry returned nothing until the iteration cap halted the run.',
      confidence: 0.91,
      evidence: [
        { label: 'Repeated call', detail: 'inventory.search ×14 with identical args' },
        { label: 'Unused parameter', detail: 'radius_km stays at the default 25 (max 500)' },
      ],
      evidenceSteps: [1, 2],
      contributing: ['No duplicate-call detection', 'Reflection prompt lacks "change something" rule'],
    },
    proposal: {
      strategy: 'guardrail',
      title: 'Block identical retries and widen search radius progressively',
      rationale: 'Detect duplicate tool calls and force the planner to change arguments; give it an explicit widening schedule.',
      target: 'agents/order_router/reflect.prompt · guards/duplicate_calls.ts',
      diff: [
        d('@', '@@ reflect.prompt'),
        d('+', 'If a tool returned no results, you MUST change at least one argument.'),
        d('+', 'For inventory.search widen radius_km: 25 → 100 → 250 → 500.'),
        d('@', '@@ guards/duplicate_calls.ts'),
        d('+', 'maxIdenticalCalls: 2'),
      ],
      risk: 'low',
      expectedSuccess: 0.94,
    },
    checks: [
      { label: 'No duplicate tool calls', detail: '3 distinct searches' },
      { label: 'Order routed', detail: 'WH-OAK-2 · 61 km' },
      { label: 'Iterations under budget', detail: '5 / 15' },
    ],
    passRate: 0.93,
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'kyc-pii-leak',
    agentKind: 'kyc',
    category: 'policy',
    severity: 'critical',
    title: 'Draft message exposed partial SSN — blocked by PII guard',
    taskTitle: 'Request missing documents from applicant A-30917',
    errorMessage: 'PII guard: draft contains ssn_partial ("***-**-4471") in outbound channel=email',
    requiresHuman: true,
    steps: [
      { kind: 'tool', name: 'kyc.get_application', ms: 330, input: { id: 'A-30917' }, output: { missing: ['proof_of_address'], ssn_last4: '4471' } },
      { kind: 'llm', name: 'llm.draft_message', ms: 1760, model: 'claude-sonnet-5-5', tokens: 1340, input: { tone: 'friendly', include_reference: true }, output: { draft: '… we matched your SSN ending ***-**-4471 …' } },
      { kind: 'guard', name: 'guard.pii_outbound', ms: 60, status: 'error', input: { channel: 'email' }, output: { blocked: true, entities: ['ssn_partial'] }, error: 'PII guard: draft contains ssn_partial ("***-**-4471") in outbound channel=email' },
      { kind: 'tool', name: 'email.send', ms: 0, status: 'skipped', input: null, output: null },
    ],
    failingStep: 1,
    investigationLog: [
      'Loaded trace · 4 steps · 2.15 s',
      'guard.pii_outbound blocked outbound email',
      'Draft used ssn_last4 as a "reference" for the applicant',
      'Full application record (incl. ssn_last4) passed into drafting context',
    ],
    rootCause: {
      summary: 'The drafting step received the full application record, including `ssn_last4`, and used it as a friendly "reference". Policy forbids any SSN fragment in outbound email.',
      confidence: 0.95,
      evidence: [
        { label: 'Sensitive field in context', detail: 'kyc.get_application output includes ssn_last4' },
        { label: 'Leak', detail: 'Draft contains "***-**-4471"' },
      ],
      evidenceSteps: [0, 1],
      contributing: ['Context not minimized before drafting', 'Prompt suggests "include a reference"'],
    },
    proposal: {
      strategy: 'prompt_patch',
      title: 'Minimize drafting context and use application ID as the reference',
      rationale: 'Remove sensitive fields before the LLM sees them and use the application ID as the reference. Compliance-sensitive, so a human must approve.',
      target: 'agents/kyc/draft_message.prompt · agents/kyc/context.ts',
      diff: [
        d('@', '@@ context.ts'),
        d('-', 'context = application'),
        d('+', 'context = pick(application, ["id", "first_name", "missing"])'),
        d('@', '@@ draft_message.prompt'),
        d('-', 'Include a reference so the applicant recognizes the request.'),
        d('+', 'Use the application ID (e.g. A-30917) as the only reference.'),
        d('+', 'Never include government IDs or fragments of them.'),
      ],
      risk: 'medium',
      expectedSuccess: 0.95,
    },
    checks: [
      { label: 'PII guard passes', detail: '0 sensitive entities' },
      { label: 'Draft references application ID', detail: 'A-30917' },
      { label: 'Compliance test set (40 drafts)', detail: '40/40 clean' },
    ],
    passRate: 0.92,
  },

  /* ------------------------------------------------------------------ */
  {
    key: 'claims-scanned-pdf',
    agentKind: 'claims',
    category: 'tool_error',
    severity: 'medium',
    title: 'PDF extraction returned empty text for a scanned claim form',
    taskTitle: 'Extract line items from claim CLM-22018',
    errorMessage: 'Validation failed: 0 line items extracted (expected ≥ 1)',
    requiresHuman: false,
    steps: [
      { kind: 'tool', name: 'docs.fetch', ms: 290, input: { claim: 'CLM-22018' }, output: { file: 'claim_form.pdf', pages: 3, has_text_layer: false } },
      { kind: 'tool', name: 'pdf.extract_text', ms: 410, status: 'warning', input: { file: 'claim_form.pdf', ocr: false }, output: { text: '', chars: 0 } },
      { kind: 'llm', name: 'llm.extract_line_items', ms: 880, model: 'claude-haiku-5-5', tokens: 310, input: { text: '' }, output: { items: [] } },
      { kind: 'guard', name: 'guard.validate_items', ms: 20, status: 'error', input: { items: 0 }, output: { valid: false }, error: 'Validation failed: 0 line items extracted (expected ≥ 1)' },
    ],
    failingStep: 1,
    investigationLog: [
      'Loaded trace · 4 steps · 1.60 s',
      'Validation failed: 0 line items',
      'pdf.extract_text returned 0 chars',
      'docs.fetch reports has_text_layer=false → scanned document',
      'pdf.extract_text supports ocr=true (not used)',
    ],
    rootCause: {
      summary: 'The claim form is a scanned image with no text layer. `pdf.extract_text` ran with `ocr=false` and returned an empty string, so the extraction step had nothing to read.',
      confidence: 0.96,
      evidence: [
        { label: 'No text layer', detail: 'docs.fetch has_text_layer = false' },
        { label: 'Empty extraction', detail: 'pdf.extract_text chars = 0' },
      ],
      evidenceSteps: [0, 1],
      contributing: ['OCR flag hard-coded to false'],
    },
    proposal: {
      strategy: 'tool_args',
      title: 'Enable OCR automatically when the PDF has no text layer',
      rationale: 'A deterministic switch on the fetched metadata; no model change required.',
      target: 'agents/claims/pipeline.ts',
      diff: [
        d('@', '@@ pipeline.ts'),
        d('-', 'pdf.extract_text({ file, ocr: false })'),
        d('+', 'pdf.extract_text({ file, ocr: !doc.has_text_layer })'),
      ],
      risk: 'low',
      expectedSuccess: 0.95,
    },
    checks: [
      { label: 'OCR text extracted', detail: '4 812 chars · 3 pages' },
      { label: 'Line items extracted', detail: '6 items' },
      { label: 'Totals reconcile', detail: '$2 418.60 = form total' },
    ],
    passRate: 0.94,
  },
];
