# NyayaLens — Project Context

## Competition
Hack2Skill PromptWars Virtual (Exclusive Edition). Problem statement: "AI for Legal Assistance & Access." Solo entry. Submission (due 26 Sept 2026) needs: a live deployed URL, a public GitHub repo under 10MB, a project description, an explicit GenAI-architecture mapping, and a demo video under 4 minutes showing live testing (no pre-filled forms).

## What it is
A self-verifying AI legal co-pilot for everyday Indian legal documents (rental agreements, offer letters, loan/EMI agreements, freelance contracts). Not a generic "chat with your PDF" tool — every generated claim about a document is checked against the document's own text before it's shown to the user. If it can't be verified, the app says so instead of guessing.

## Four user journeys (covers all 7 use-cases in the problem statement)
1. **Simplify** — upload a document → clause-by-clause plain-language explanation + risk flags, each cited to the exact source clause.
2. **Compare** — upload two documents → structured diff of substantive differences, which side each favors.
3. **Ask** — chat with the document, answers grounded and cited to specific clauses.
4. **Prepare** — auto-generated checklist and a "questions to ask your lawyer" list, built from whatever got flagged as risky or low-confidence.

## Non-negotiable design principles
- Every claim cites the exact clause it came from.
- Unverifiable claim → abstain and flag for human review. Never guess.
- Always framed as "informational, not legal advice" — recommend a licensed advocate for real decisions, especially on anything flagged high-risk.
- No persistent storage of uploaded document content beyond the session (these documents contain names, salaries, addresses).
- Solo build, ~10 days, must run on free tiers, repo must stay under 10MB.

## Tech stack
- Next.js (latest stable), TypeScript, App Router, Tailwind — one deployable app, no separate backend.
- Gemini API (multimodal — handles PDF/image parsing, text generation, and embeddings). Confirm the exact current model string in Google AI Studio before hardcoding it; Flash-tier is the right cost/speed fit here.
- In-memory retrieval, no persistent vector DB — retrieval is over one uploaded document's clauses (10-50 chunks), not a corpus, so cosine similarity over Gemini embeddings is enough.
- Deployment: Vercel.

## Data model
```ts
interface Clause {
  id: string;
  sectionNumber?: string;
  heading?: string;
  rawText: string;
  category: string; // "Payment" | "Termination" | "Liability" | "Deposit" | ...
}
```

## Verification pipeline (the core differentiator)
Dual-gate pattern, adapted from a prior RAG project that hit 0% hallucination / +25 points context recall over regulatory text:
- Gate 1 (no LLM call): lexical/numerical overlap — do the claim's key terms and numbers actually appear in the cited clause?
- Gate 2 (LLM-judge): a second Gemini call checks the claim against the source clause, returns verified/unverified + confidence.
- Both pass → show with citation. Either fails → abstain, flag "needs manual review."

## GenAI mapping (for submission — keep this table in the README too)
| Feature | Gemini capability | Where it's used |
|---|---|---|
| Ingestion | Native multimodal PDF/image understanding | Raw upload → structured clause JSON |
| Simplify | Generation | Plain-language rewrite per clause |
| Risk flagging | Generation + grounding | Severity + cited risky clauses |
| Verification gate | Second-pass generation (LLM-judge) | Checks every claim before display |
| Retrieval | Embeddings API | Powers Compare and Chat |
| Compare | Generation (structured reasoning) | Clause-to-clause diff across 2 docs |
| Chat | Generation, RAG-grounded, streaming | Cited Q&A over the document |
| Checklist | Generation (templated) | Next-steps + lawyer questions |

## Phase roadmap
0. Concept & architecture (this file)
1. Setup — scaffold, Gemini connectivity check, live URL day one
2. Document ingestion
3. Simplify + verification engine
4. Compare mode
5. Chat Q&A
6. Checklist + UI polish (stretch: Hindi/Kannada output toggle)
7. Hardening + docs
8. Demo video + submit
