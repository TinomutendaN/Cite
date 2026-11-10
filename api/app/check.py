"""Run the demo questions (data/documents/DEMO_QUESTIONS.md) and print what Cite does with them.

    python -m app.check                 # full answers, using the provider in settings
    python -m app.check --no-model      # search + threshold only: no model calls, nearly free
    python -m app.check --provider anthropic
    python -m app.check --group unknown # starter | video | clear | exact | meaning | cross | unknown

Nothing is written to `usage` or `queries`. The summary at the end shows how
the best similarity of answerable questions compares with the "I don't know"
ones, to help set RAG_MIN_SIMILARITY.
"""

import argparse
import sys
from dataclasses import dataclass

from app.config import RAG_MIN_SIMILARITY, RAG_TOP_K
from app.db import connect
from app.llm import get_provider

HB = "HR-HB-2026"
PORTAL = "PX-GUIDE-07"
SUPPLY = "KVHP-SC-2026-014"
IT = "KVHP-IT-2025-007"
BAA = "KVHP-BAA-2025-007"


@dataclass
class Q:
    text: str
    expect_found: bool | None  # None: no expectation
    docs: tuple[str, ...] = ()  # documents the answer should come from (any of them)
    note: str = ""  # expected answer, short


GROUPS: dict[str, list[Q]] = {
    "starter": [
        Q("How many days of PTO do new employees get?", True, (HB,), "15 days (120 h) in years 0-2"),
        Q("What should I do if I'm sick for a week?", True, ("POL-114",)),
        Q("Can I use AI tools like ChatGPT to summarize patient notes?", True, ("POL-310",), "No, unless CIO-approved + BAA"),
        Q("What's the hotel limit when I travel for work?", True, ("POL-205",), "$189 / $259 high-cost"),
        Q("I lost my work laptop. What do I do?", True, ("POL-310",)),
        Q("When does the Brightline supply contract renew?", True, (SUPPLY,), "Auto-renews 12 months; 90 days' notice"),
    ],
    "video": [
        Q("How many days of leave do new employees get?", True, (HB, "POL-114"), "15 days PTO + sick bank + 8 holidays"),
        Q("What is the CEO's salary?", False),
        Q("POL-114", True, ("POL-114",), "Sick Leave and Return to Work"),
        Q("What happens if I'm sick for a week?", True, ("POL-114",), "sick bank, note after 3 shifts, FMLA/STD after 5 days"),
    ],
    "clear": [
        Q("How much notice do I need to give when calling in sick?", True, ("POL-114",), "2 h; providers 4 h"),
        Q("Do I need a doctor's note?", True, ("POL-114",), "3+ consecutive shifts"),
        Q("Does unused sick leave roll over?", True, ("POL-114",), "No"),
        Q("When can I come back after a fever?", True, ("POL-114",), "24 h fever-free without medicine"),
        Q("What's the meal allowance when traveling?", True, ("POL-205",), "$65/day; 75% first/last day"),
        Q("Can I expense a beer with dinner?", True, ("POL-205",), "No, alcohol never reimbursable"),
        Q("What's the hotel limit?", True, ("POL-205",), "$189 / $259"),
        Q("How long do I have to submit expenses?", True, ("POL-205",), "30 days; 60 needs CFO"),
        Q("When do I need a receipt?", True, ("POL-205",), "$25+ and all lodging"),
        Q("How much CME money do physicians get?", True, ("POL-205",), "$2,500 + 5 days"),
        Q("How long must my password be?", True, ("POL-310",), "14 chars; MFA"),
        Q("How do I send PHI securely by email?", True, ("POL-310",), 'Subject starts "Secure:"'),
        Q("Can I use ChatGPT with patient information?", True, ("POL-310",), "No, unless CIO-approved + BAA"),
        Q("Can I look up my own medical record in the EHR?", True, ("POL-301",), "No; portal or HIM"),
        Q("How fast must I report a privacy breach?", True, ("POL-301",), "24 h, ext. 2450 / SafeReport"),
        Q("What's the deadline for the flu shot?", True, ("POL-120",), "Dec 1; exemptions Oct 1"),
        Q("I had a needlestick. What do I do?", True, ("POL-120", "POL-402"), "wash, supervisor, ext. 2210 within 1 h"),
        Q("Can a patient give me a gift?", True, ("POL-101",), "<= $25, never cash/gift cards"),
        Q("Can a drug rep buy me lunch?", True, ("POL-101",), "Only approved education, <= $50"),
        Q("How many days a week can I work from home?", True, ("POL-130",), "Up to 3, after 90 days"),
        Q("Is there an internet stipend for remote work?", True, ("POL-130",), "$40/month if 2+ days"),
        Q("How quickly must I report a patient fall?", True, ("POL-402",), "24 h; serious harm immediately"),
        Q("How fast will my care team reply to a portal message?", True, (PORTAL,), "2 business days"),
        Q("My portal activation code doesn't work.", True, (PORTAL,), "Expire after 30 days; (937) 555-0160"),
        Q("Can I see my 14-year-old's full record?", True, (PORTAL,), "No; limited proxy 12-17"),
    ],
    # Search terms: also shown as raw hybrid_search results.
    "exact": [
        Q("POL-114", True, ("POL-114",)),
        Q("KVHP-IT-2025-007", True, (IT, BAA)),
        Q("BL-1042", True, (SUPPLY,), "nitrile gloves, $7.85"),
        Q("ext. 4357", True, ("POL-310",), "IT Service Desk"),
        Q("[EXTERNAL]", True, ("POL-310",)),
        Q("Eastwood Urgent Care", True, (HB, "POL-114", "POL-120", "POL-402", PORTAL)),
    ],
    "meaning": [
        Q("what if my kid is sick and I need to stay home", True, ("POL-114",), "§5 family member"),
        Q("someone opened the wrong patient's chart", True, ("POL-301",), "§8, §9"),
        # Related passages exist (hours, overtime), so a cited "the documents don't cover this" is fine.
        Q("my boss keeps texting me after hours", None, (), "nothing exact; must not invent a policy"),
        Q("getting paid back for driving between clinics", True, ("POL-205",), "§5.3 mileage"),
        Q("a vendor wants to take me to a ball game", True, ("POL-101",), "§4.2"),
    ],
    "cross": [
        Q("I lost my work phone with patient emails on it. What do I do?", True, ("POL-310", "POL-301")),
        Q("How much total time off does a new full-time nurse get in year one?", True, (HB, "POL-114")),
        Q("Does Halverson have to tell us about a data breach, and how fast?", True, (BAA, IT), "5 business days; 48 h"),
    ],
    "unknown": [
        Q("What is the CEO's salary?", False),
        Q("Does KVHP offer pet insurance?", False),
        Q("Where do I park at the corporate office?", False),
        Q("What is the price of N95 respirators from Brightline?", False),
        Q("What is the deductible on the medical plan?", False),
        Q("How much will the Larkspur pilot cost?", False),
    ],
}


@dataclass
class Row:
    group: str
    q: Q
    found: bool
    top_similarity: float
    keyword_hit: bool
    gated: bool
    uncited: bool
    right_doc: bool | None


def mark(ok: bool | None) -> str:
    return "  " if ok is None else ("OK" if ok else "XX")


def passage_line(p, prefix: str = "") -> str:
    section = f" | {p.section}" if p.section else ""
    return f"{prefix}{p.document_id} p.{p.page} ¶{p.paragraph}{section}  ({p.match_type}, sim {p.similarity:.3f})"


def run_question(group: str, q: Q, provider: str, use_model: bool, conn) -> Row:
    from app.rag import answer, should_skip_model
    from app.search import hybrid_search

    print(f"\n[{group}] {q.text}")
    if q.note:
        print(f"  expected: {q.note}" + (f"  ({', '.join(q.docs)})" if q.docs else ""))

    if use_model:
        ans = answer(q.text, provider=provider, conn=conn)
        passages, found, gated, uncited = ans.passages, ans.found, ans.gated, ans.uncited
    else:
        passages = hybrid_search(q.text, RAG_TOP_K, conn=conn)
        gated = should_skip_model(passages)
        found, uncited, ans = not gated, False, None

    top = max((p.similarity for p in passages), default=0.0)
    keyword_hit = any(p.match_type == "exact" for p in passages)
    expect_ok = None if q.expect_found is None else (found == q.expect_found)

    if use_model:
        status = "found" if found else ("not found (threshold, no model call)" if gated else "not found")
        if uncited:
            status += " (MODEL ANSWERED WITHOUT CITATIONS)"
    else:
        status = "skipped by threshold" if gated else "would call model"
    print(f"  {mark(expect_ok)} {status} | top sim {top:.3f} | keyword hit: {'yes' if keyword_hit else 'no'}")

    if ans is not None:
        for line in ans.text.splitlines():
            print(f"     {line}")
        for s in ans.sources:
            section = f" | {s['section']}" if s["section"] else ""
            print(f"     [{s['n']}] {s['document_id']} p.{s['page']} ¶{s['paragraph']}{section}"
                  f"  ({s['match_type']}, sim {s['similarity']:.3f})")
        print(f"     {ans.model}, {ans.latency_ms} ms, {ans.input_tokens} in / {ans.output_tokens} out")

    print("  retrieved:")
    for i, p in enumerate(passages, start=1):
        print(passage_line(p, f"    {i}. "))

    right_doc = None
    if q.docs:
        if ans is not None and ans.found:
            right_doc = any(s["document_id"] in q.docs for s in ans.sources)
        else:
            right_doc = any(p.document_id in q.docs for p in passages)
        print(f"  {mark(right_doc)} expected document {'cited' if ans is not None and ans.found else 'retrieved'}")

    return Row(group, q, found, top, keyword_hit, gated, uncited, right_doc)


def print_summary(rows: list[Row], use_model: bool) -> None:
    print("\n" + "=" * 78)
    print(f"SUMMARY  (RAG_MIN_SIMILARITY = {RAG_MIN_SIMILARITY}, threshold applies only without a keyword hit)")

    answerable = [r for r in rows if r.q.expect_found is True]
    unknown = [r for r in rows if r.q.expect_found is False]
    wrong = [r for r in rows if r.q.expect_found is not None and r.found != r.q.expect_found]
    wrong_doc = [r for r in rows if r.right_doc is False]

    def stats(name: str, group: list[Row]) -> None:
        if not group:
            return
        sims = sorted(r.top_similarity for r in group)
        print(f"  {name:<12} n={len(group):<3} top sim min {sims[0]:.3f}  median {sims[len(sims) // 2]:.3f}  max {sims[-1]:.3f}")

    stats("answerable", answerable)
    stats("unknown", unknown)

    # The threshold only decides questions with no keyword hit.
    a = [r.top_similarity for r in answerable if not r.keyword_hit]
    u = [r.top_similarity for r in unknown if not r.keyword_hit]
    if a and u:
        lo_answerable, hi_unknown = min(a), max(u)
        print(f"  without a keyword hit: lowest answerable {lo_answerable:.3f}, highest unknown {hi_unknown:.3f}")
        if hi_unknown < lo_answerable:
            print(f"  -> any threshold between them separates the two; midpoint {(hi_unknown + lo_answerable) / 2:.3f}")
        else:
            print("  -> they overlap; keep the threshold at or below the lowest answerable and let the model say NOT_FOUND")
    unknown_kw = [r for r in unknown if r.keyword_hit]
    if unknown_kw:
        print(f"  {len(unknown_kw)} unknown question(s) had a keyword hit, so they always reach the model:")
        for r in unknown_kw:
            print(f"     - {r.q.text}")

    if use_model:
        print(f"\n  found matches expectation: {len(rows) - len(wrong) - sum(r.q.expect_found is None for r in rows)}"
              f"/{sum(r.q.expect_found is not None for r in rows)}")
    else:
        wrong = [r for r in rows if r.q.expect_found is True and r.gated]
        print(f"\n  answerable questions the threshold would skip: {len(wrong)}")
    for r in wrong:
        print(f"     XX [{r.group}] {r.q.text}  (top sim {r.top_similarity:.3f})")
    if wrong_doc:
        print(f"  expected document missing: {len(wrong_doc)}")
        for r in wrong_doc:
            print(f"     XX [{r.group}] {r.q.text}  (wanted {', '.join(r.q.docs)})")
    uncited = [r for r in rows if r.uncited]
    if uncited:
        print(f"  answered without citations (counted as not found): {len(uncited)}")
        for r in uncited:
            print(f"     - [{r.group}] {r.q.text}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the demo questions through Cite.")
    parser.add_argument("--no-model", action="store_true", help="search and threshold only; no model calls")
    parser.add_argument("--provider", choices=["openai", "anthropic", "ollama"])
    parser.add_argument("--group", choices=list(GROUPS))
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    groups = {args.group: GROUPS[args.group]} if args.group else GROUPS
    rows: list[Row] = []
    with connect() as conn:
        provider = args.provider or get_provider(conn)
        print(f"provider: {provider}{'  (no model calls)' if args.no_model else ''}")
        for group, questions in groups.items():
            for q in questions:
                rows.append(run_question(group, q, provider, not args.no_model, conn))

    print_summary(rows, not args.no_model)


if __name__ == "__main__":
    main()
