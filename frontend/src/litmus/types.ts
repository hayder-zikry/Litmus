// The data contract Litmus codes against — mirrors the backend's models.py /
// example_response.json. The frontend only ever *reads* these shapes.

export type Verdict =
  | 'supported'
  | 'disputed'
  | 'refuted'
  | 'unverified'
  | 'not_checkable'

export type EvidenceSource =
  | 'factcheck_api'
  | 'grounding_metadata'
  | 'schema_fallback'
  | 'none'

export type JobStatus =
  | 'queued'
  | 'extracting'
  | 'verifying'
  | 'tracing'
  | 'done'
  | 'failed'

export interface Evidence {
  url: string
  title?: string | null
  publisher?: string | null
  date?: string | null
}

export interface Claim {
  id: string
  text: string
  verbatim?: string
  start_s: number
  end_s: number
  claim_type?: string
  checkable: boolean
  entities?: string[]
}

export interface ClaimVerdict {
  claim_id: string
  verdict: Verdict
  confidence: number
  reasoning: string
  evidence: Evidence[]
  evidence_source: EvidenceSource
}

export interface Extraction {
  language?: string
  summary?: string
  segments?: { start_s: number; end_s: number; speech?: string; on_screen_text?: string | null }[]
  claims: Claim[]
  context_mismatch?: string | null
  manipulation_signals?: string[]
  injection_attempt?: boolean
}

export interface MatchingImage {
  url: string
  page_url: string
  date?: string | null
}

export interface Provenance {
  pages_with_matching_images: number
  full_matching_images: MatchingImage[]
  partial_matching_images: MatchingImage[]
  likely_recycled: boolean
}

export interface Score {
  percentage: number | null
  refuted: number
  disputed: number
  unverified: number
  supported: number
  not_checkable: number
  checkable_total: number
  limited_evidence: boolean
}

export interface AnalysisResult {
  job_id: string
  status: JobStatus
  video_id: string
  video_url: string
  start_s?: number
  end_s?: number
  extraction: Extraction
  verdicts: ClaimVerdict[]
  provenance: Provenance
  score: Score
}
