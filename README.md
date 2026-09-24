# NyayaLens — Self-Verifying AI Legal Co-Pilot for Indian Contracts

A self-verifying AI legal co-pilot designed to help Indian citizens review, simplify, compare, and interrogate everyday legal documents (rental agreements, employment offers, service contracts) with deterministic dual-gate factual verification.

> **Hack2Skill PromptWars Virtual (Exclusive Edition)**  
> **Problem Statement:** AI for Legal Assistance & Access  
> **Live Deployment:** [nyaya-lens-rust.vercel.app](https://nyaya-lens-rust.vercel.app)

---

## Project Description

NyayaLens is a self-verifying AI legal co-pilot designed to help Indian citizens review, simplify, compare, and interrogate everyday contracts such as rental agreements, offer letters, and service agreements. In the legal domain, generic generative AI frequently hallucinates crucial terms, misstates deposit amounts, or invents penalty conditions that can cause severe financial and legal harm to signers. Unlike standard RAG chatbots that blindly trust and stream probabilistic LLM outputs, NyayaLens enforces an automated deterministic Dual-Gate verification pipeline before displaying any factual claim. Every simplification, comparison diff, and Q&A answer is mathematically validated for lexical and numerical overlap (Gate 1) and cross-examined by an impartial LLM judge (Gate 2). If any claim fails verification or lacks grounding in the contract's actual text, NyayaLens strictly abstains and marks the clause as unverified with neutral risk, ensuring users never rely on unconfirmed AI speculation.

---

## GenAI Architecture & Model Cascade Mapping

Every feature in NyayaLens is mapped directly to Google Gemini capabilities, consolidated through a single resilience cascade in `lib/models.ts`:

| Feature | Gemini Capability | Model Cascade | Execution & Grounding |
|---|---|---|---|
| **Document Ingestion** | Native Multimodal Understanding | `gemini-3.1-flash-lite`<br>*(Fallbacks: `gemini-flash-latest`, `gemini-3-flash-preview`, `gemini-3.6-flash`)* | Ingests raw PDF/images, segments full document into structured clauses with verbatim text. |
| **Clause Simplification** | Structured Generation | `DEFAULT_MODEL_CASCADE` | Plain-language clause explanation and practical takeaway in everyday language. |
| **Multilingual Output** | Trilingual Generation | `DEFAULT_MODEL_CASCADE` | Full translations into **English**, **Hindi (हिंदी)**, and **Kannada (ಕನ್ನಡ)** while preserving legal citations. |
| **Risk Severity Detection** | Grounded Classification | `DEFAULT_MODEL_CASCADE` | Identifies high/medium/low risks. Automatically resets to `unknown` if verification fails. |
| **Dual-Gate Verification** | Gate 1: Lexical Check<br>Gate 2: LLM-Judge | Gate 1: Deterministic Token Overlap<br>Gate 2: `DEFAULT_MODEL_CASCADE` | Verifies numbers, timelines, and claims against source text before display. Abstains on failure. |
| **Semantic Retrieval** | Dense Vector Embeddings | `gemini-embedding-001`<br>*(Fallbacks: `gemini-embedding-2`, `gemini-embedding-2-preview`)* | In-memory cosine similarity retrieval over document clauses (Top-5 matching chunks). |
| **Contract Comparison** | Alignment & Diff Reasoning | `DEFAULT_MODEL_CASCADE` | Aligns Base vs. Renewal drafts, verifies substantive diffs, and computes party bias (Landlord vs. Tenant). |
| **Grounded Contract Q&A** | Streaming Generation *(Latency Exception)* | `CHAT_STREAMING_MODELS`<br>*(Prioritizes `gemini-3.1-flash-lite` for ultra-low TTFT)* | Real-time SSE token streaming over retrieved clauses with exact verbatim citation drawer. |
| **Pre-Signing Checklist** | Templated Generation | `DEFAULT_MODEL_CASCADE` | Practical action items + advocate discussion questions grounded via lexical verification. |

---

## Core Features Implemented

1. **Document Ingestion & Parsing**: Native multimodal extraction supporting PDF, PNG, JPG, and WebP (up to 10MB) with PDF magic header validation.
2. **Dual-Gate Factual Verification**:
   - **Gate 1 (Lexical & Numerical Overlap)**: Fast, deterministic verification ensuring every figure (e.g., ₹1,50,000 deposit), timeframe, and entity appears in the source text.
   - **Gate 2 (Impartial LLM Judge)**: Adversarial verification call checking factual fidelity and flagging ungrounded claims.
   - **Strict Abstention**: Unverified claims are flagged as *Needs Review* with risk severity reset to neutral (`unknown`), preventing false security.
3. **Contract Version Comparison (Base vs. Renewal)**:
   - Aligns corresponding clauses between two versions.
   - Identifies whether substantive differences favor Party A (e.g., Landlord), Party B (e.g., Tenant), or are Neutral.
   - Two-sided diff verification against both source documents.
4. **Grounded Contract Q&A**:
   - Ask natural language questions in English, Hindi, or Kannada.
   - Semantic retrieval over clause embeddings.
   - Real-time streaming response paired with a slide-out drawer displaying the exact cited source clause.
5. **Advocate Consultation Checklist**:
   - Automatically generates pre-signing negotiation actions.
   - Provides targeted questions for advocate consultation, explicitly framed as legal inquiries rather than settled legal conclusions.

---

## Known Limitations

- **Informational Assistance, Not Formal Legal Advice**: NyayaLens provides educational contract simplification, risk flagging, and consultation preparation; it does not replace a licensed advocate for contentious disputes or statutory filings.
- **Contract-Bounded Scope**: Dual-gate verification evaluates claims strictly against the text within the uploaded document. It does not independently verify unstated Indian case law precedents, state-specific rent control amendments, or municipal bylaws unless mentioned in the contract.
- **Document Layout Dependency**: The parser is optimized for standard contracts with numbered or distinct provisions. Highly degraded physical scans, handwritten marginalia, or narrative letters may require OCR pre-processing.
- **Privacy-First Session Storage**: In adherence to strict privacy standards for sensitive contracts (containing names, PANs, addresses, and salaries), NyayaLens stores parsed clauses and embeddings purely in memory and browser session storage with zero persistent cloud database storage.

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ or 20+
- Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/abhijithbhat/NyayaLens.git
cd NyayaLens

# Copy environment variables and configure your Gemini API key
cp .env.example .env.local
# Add GEMINI_API_KEY=your_key_here in .env.local

# Install dependencies
npm install

# Run the local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Production Build & Validation
```bash
npm run build
npm start
```
