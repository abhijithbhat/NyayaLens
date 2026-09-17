# NyayaLens

A self-verifying AI legal co-pilot for everyday Indian legal documents (rental agreements, offer letters, loan/EMI agreements, freelance contracts).

> **Status:** Under active development for Hack2Skill PromptWars Virtual (Exclusive Edition).

---

## GenAI Architecture Mapping

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

---

## Getting Started

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Add your Gemini API Key in `.env.local`:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) with your browser.
