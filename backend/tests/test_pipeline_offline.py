 """
Offline verification of the agent-pipeline orchestration: schemas, mock
adapters, PipelineService, and the Supabase persistence contract shape --
everything that does NOT require fastapi/sqlalchemy/langchain/openai/
sentence-transformers/supabase to be installed, since those aren't needed
to exercise this logic (only real_*.py's __init__ imports them, lazily).

This is a real, executed check of the orchestration logic -- not a claim
that the full HTTP stack works, which needs the full dependency set and a
real Supabase project (see requirements-agents.txt / requirements-supabase.txt
and README.md's "Agent pipeline" section) to verify beyond this.

Run with: python3 -m unittest tests.test_pipeline_offline -v
(from the backend/ directory)
"""
import sys
import unittest
import unittest.mock
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pydantic import ValidationError

from app.agents.adapters.mock import MockFitAgent, MockOutreachAgent, MockProductAgent
from app.agents.exceptions import AgentClarificationNeeded
from app.agents.interfaces import FitAgent, OutreachAgent, ProductAgent
from app.agents.schemas import (
    DraftMessage,
    FitRequest,
    ICPRequest,
    ICPResult,
    OutreachRequest,
    RankedCompany,
    ScoreFactorResult,
    SearchPreferences,
    SenderInfo,
)
from app.agents.service import PipelineService, load_default_companies
from app.integrations.email.smtp_sender import EmailSendError, SmtpNotConfiguredError, send_email
from app.integrations.supabase.database import (
    VALID_OUTREACH_STATUSES,
    SupabaseConfigError,
    get_client,
    save_outreach,
    update_outreach_status,
)


class FakeSupabaseTables:
    """In-memory stand-in for app.integrations.supabase.database, with the
    exact same function signatures, so PipelineService is exercised through
    its real call sequence -- not a hand-waved substitute."""

    def __init__(self):
        self._id = 0
        self.products: list[dict] = []
        self.runs: list[dict] = []
        self.prospects: list[dict] = []
        self.outreach: list[dict] = []

    def _next_id(self) -> str:
        self._id += 1
        return f"id-{self._id}"

    def save_product(self, product_name, product_description, sender_name,
                      sender_company_name, sender_email, sender_phone):
        row = {
            "id": self._next_id(),
            "product_name": product_name,
            "product_description": product_description,
            "sender_name": sender_name,
            "sender_company_name": sender_company_name,
            "sender_email": sender_email,
            "sender_phone": sender_phone,
        }
        self.products.append(row)
        return row

    def create_run(self, product_id, preferred_city=None, requested_company_count=None):
        row = {
            "id": self._next_id(),
            "product_id": product_id,
            "preferred_city": preferred_city,
            "requested_company_count": requested_company_count,
        }
        self.runs.append(row)
        return row

    def save_prospect(self, run_id, source_company_id, company_name, fit_score,
                       match_level, reason, company_email, research_status="pending"):
        row = {
            "id": self._next_id(),
            "run_id": run_id,
            "source_company_id": source_company_id,
            "company_name": company_name,
            "fit_score": fit_score,
            "match_level": match_level,
            "reason": reason,
            "company_email": company_email,
            "research_status": research_status,
        }
        self.prospects.append(row)
        return row

    def save_outreach(self, prospect_id, status="not_sent", status_reason=None,
                       email_subject=None, message=None, reply_status=None, sent_at=None):
        if status not in VALID_OUTREACH_STATUSES:
            raise ValueError(f"invalid outreach status {status!r}")
        row = {
            "id": self._next_id(),
            "prospect_id": prospect_id,
            "status": status,
            "status_reason": status_reason,
            "email_subject": email_subject,
            "message": message,
            "reply_status": reply_status,
            "sent_at": sent_at,
        }
        self.outreach.append(row)
        return row

    def update_outreach_status(self, outreach_id, status, status_reason=None, sent_at=None):
        if status not in VALID_OUTREACH_STATUSES:
            raise ValueError(f"invalid outreach status {status!r}")
        for row in self.outreach:
            if row["id"] == outreach_id:
                row["status"] = status
                if status_reason is not None:
                    row["status_reason"] = status_reason
                if sent_at is not None:
                    row["sent_at"] = sent_at
                elif status == "sent":
                    row["sent_at"] = "2026-01-01T00:00:00+00:00"
                return row
        raise RuntimeError("not found")

    def get_prospect(self, prospect_id):
        return next((row for row in self.prospects if row["id"] == prospect_id), None)

    def get_outreach(self, outreach_id):
        return next((row for row in self.outreach if row["id"] == outreach_id), None)


class SchemaTests(unittest.TestCase):
    """The pydantic shapes agents/callers exchange -- construct real
    instances and confirm validation actually enforces the contract."""

    def test_icp_result_needs_clarification_shape(self):
        result = ICPResult(
            status="needs_clarification",
            icp_industries=[],
            buyer_profile="",
            sender_info=SenderInfo(name="A", company_name="B", email="a@b.com", phone="123"),
            search_preferences=SearchPreferences(),
            clarification_question="Who is the buyer?",
        )
        self.assertEqual(result.status, "needs_clarification")
        self.assertIsNotNone(result.clarification_question)

    def test_ranked_company_requires_company_id(self):
        with self.assertRaises(ValidationError):
            RankedCompany(eligible=True, factors=[])  # missing company_id/company_name

    def test_score_factor_result_allows_none_raw_score(self):
        f = ScoreFactorResult(factor="description", raw_score=None, missing_reason="not scored")
        self.assertIsNone(f.raw_score)

    def test_draft_message_status_values_round_trip(self):
        d = DraftMessage(subject=None, body=None, status="needs_review", status_reason="no email")
        self.assertEqual(d.status, "needs_review")


class MockAdapterTests(unittest.TestCase):
    """Confirm the mock adapters satisfy the abstract interfaces and return
    schema-valid output -- what every downstream caller relies on."""

    def test_mock_product_agent_is_a_product_agent(self):
        self.assertIsInstance(MockProductAgent(), ProductAgent)
        result = MockProductAgent().run(
            ICPRequest(
                product_name="Widget",
                product_description="A widget for widgets.",
                sender_info=SenderInfo(name="A", company_name="B", email="a@b.com", phone="1"),
            )
        )
        self.assertEqual(result.status, "ready")
        self.assertTrue(result.icp_industries)

    def test_mock_fit_agent_respects_top_n(self):
        self.assertIsInstance(MockFitAgent(), FitAgent)
        companies = [{"company_id": str(i), "company_name": f"Co {i}"} for i in range(10)]
        ranked = MockFitAgent().run(
            FitRequest(icp_description="x", companies=companies, top_n=3)
        )
        self.assertEqual(len(ranked), 3)
        self.assertTrue(all(isinstance(c, RankedCompany) for c in ranked))

    def test_mock_outreach_agent_flags_missing_email(self):
        self.assertIsInstance(MockOutreachAgent(), OutreachAgent)
        draft = MockOutreachAgent().run(
            OutreachRequest(
                company_id="1", company_name="Co", company_email=None, product_name="P",
                sender_name="A", sender_company="B", sender_email="a@b.com", sender_phone="1",
            )
        )
        self.assertEqual(draft.status, "needs_review")
        self.assertIsNone(draft.subject)


class PipelineServiceTests(unittest.TestCase):
    """Exercise PipelineService's real call sequence against the fake
    Supabase tables, using the actual mock agents -- this is the same code
    path api/v1/routes/pipeline.py calls, minus the HTTP layer."""

    def setUp(self):
        self.fake_db = FakeSupabaseTables()
        # PipelineService imports `db` as a module reference and calls
        # db.save_product(...) etc, so patch the module's functions in
        # place -- this exercises the exact call signatures it uses.
        import app.agents.service as service_module

        self._service_module = service_module
        self._orig = {
            name: getattr(service_module.db, name)
            for name in (
                "save_product", "create_run", "save_prospect",
                "save_outreach", "update_outreach_status",
                "get_prospect", "get_outreach",
            )
        }
        service_module.db.save_product = self.fake_db.save_product
        service_module.db.create_run = self.fake_db.create_run
        service_module.db.save_prospect = self.fake_db.save_prospect
        service_module.db.save_outreach = self.fake_db.save_outreach
        service_module.db.update_outreach_status = self.fake_db.update_outreach_status
        service_module.db.get_prospect = self.fake_db.get_prospect
        service_module.db.get_outreach = self.fake_db.get_outreach

    def tearDown(self):
        for name, fn in self._orig.items():
            setattr(self._service_module.db, name, fn)

    def test_discover_persists_product_run_and_eligible_prospects_only(self):
        service = PipelineService()  # defaults to the mock agents
        companies = [{"company_id": str(i), "company_name": f"Co {i}", "email": f"co{i}@x.com"} for i in range(5)]
        result = service.discover(
            product_name="Widget Pro",
            product_description="Helps factories track widget inventory in real time.",
            sender_name="Nouf", sender_company_name="Silah",
            sender_email="nouf@silah.sa", sender_phone="+966500000000",
            preferred_city="Riyadh", requested_company_count=3,
            companies=companies,
        )
        self.assertEqual(result["status"], "ready")
        self.assertEqual(len(self.fake_db.products), 1)
        self.assertEqual(self.fake_db.products[0]["product_name"], "Widget Pro")
        self.assertEqual(len(self.fake_db.runs), 1)
        self.assertEqual(self.fake_db.runs[0]["product_id"], self.fake_db.products[0]["id"])
        self.assertEqual(self.fake_db.runs[0]["preferred_city"], "Riyadh")
        # MockFitAgent marks every company eligible=True, so all 3 (top_n) persist
        self.assertEqual(len(result["prospects"]), 3)
        self.assertEqual(len(self.fake_db.prospects), 3)
        for row in self.fake_db.prospects:
            self.assertEqual(row["run_id"], self.fake_db.runs[0]["id"])
            self.assertIsNotNone(row["fit_score"])
            self.assertEqual(row["match_level"], "medium match")

    def test_discover_needs_clarification_persists_nothing(self):
        class VagueProductAgent(ProductAgent):
            def run(self, request):
                return ICPResult(
                    status="needs_clarification",
                    icp_industries=[], buyer_profile="",
                    sender_info=request.sender_info,
                    search_preferences=request.search_preferences,
                    clarification_question="What problem does this solve?",
                )

        service = PipelineService(product_agent=VagueProductAgent())
        result = service.discover(
            product_name="???", product_description="stuff",
            sender_name="A", sender_company_name="B",
            sender_email="a@b.com", sender_phone="1",
        )
        self.assertEqual(result["status"], "needs_clarification")
        self.assertEqual(result["clarification_question"], "What problem does this solve?")
        self.assertEqual(len(self.fake_db.products), 0)
        self.assertEqual(len(self.fake_db.runs), 0)

    def test_discover_only_persists_eligible_companies(self):
        class PartialFitAgent(FitAgent):
            def run(self, request):
                out = []
                for i, company in enumerate(request.companies):
                    eligible = i % 2 == 0
                    out.append(
                        RankedCompany(
                            company_id=company["company_id"],
                            company_name=company["company_name"],
                            eligible=eligible,
                            exclusion_reason=None if eligible else "revenue",
                            total_score=0.8 if eligible else None,
                            coverage=1.0 if eligible else 1 / 3,
                            fit_label="high match" if eligible else None,
                            factors=[],
                            email=company.get("email"),
                        )
                    )
                return out

        service = PipelineService(fit_agent=PartialFitAgent())
        companies = [{"company_id": str(i), "company_name": f"Co {i}"} for i in range(6)]
        result = service.discover(
            product_name="W", product_description="d",
            sender_name="A", sender_company_name="B",
            sender_email="a@b.com", sender_phone="1",
            companies=companies, requested_company_count=6,
        )
        # 3 of 6 companies are eligible (even indices) -- only those persist
        self.assertEqual(len(result["prospects"]), 3)
        self.assertEqual(len(self.fake_db.prospects), 3)

    def test_discover_surfaces_fit_agent_clarification_after_product_saved(self):
        class ClarifyingFitAgent(FitAgent):
            def run(self, request):
                raise AgentClarificationNeeded(reason="no industries", prompt_for_user="Who buys this?")

        service = PipelineService(fit_agent=ClarifyingFitAgent())
        result = service.discover(
            product_name="W", product_description="d",
            sender_name="A", sender_company_name="B",
            sender_email="a@b.com", sender_phone="1",
            companies=[{"company_id": "1", "company_name": "Co"}],
        )
        self.assertEqual(result["status"], "needs_clarification")
        self.assertEqual(result["clarification_question"], "Who buys this?")
        # product/run already existed by the time Agent 2 raised -- not rolled back
        self.assertEqual(len(self.fake_db.products), 1)
        self.assertEqual(len(self.fake_db.runs), 1)
        self.assertEqual(len(self.fake_db.prospects), 0)

    def test_draft_outreach_maps_drafted_and_needs_review_to_correct_status(self):
        service = PipelineService()  # MockOutreachAgent
        sender = SenderInfo(name="A", company_name="B", email="a@b.com", phone="1")

        with_email = {"id": "p1", "source_company_id": "c1", "company_name": "Co", "company_email": "co@x.com"}
        row = service.draft_outreach(with_email, product_name="Widget", sender=sender)
        self.assertEqual(row["status"], "draft")
        self.assertIsNotNone(row["email_subject"])

        without_email = {"id": "p2", "source_company_id": "c2", "company_name": "Co2", "company_email": None}
        row2 = service.draft_outreach(without_email, product_name="Widget", sender=sender)
        self.assertEqual(row2["status"], "not_sent")
        self.assertIsNone(row2["email_subject"])

    def test_approve_then_send_status_transitions(self):
        sent_calls = []
        service = PipelineService(send_email=lambda **kwargs: sent_calls.append(kwargs))
        prospect = self.fake_db.save_prospect(
            run_id="r1", source_company_id="c1", company_name="Co",
            fit_score=0.9, match_level="high match", reason=None, company_email="co@x.com",
        )
        outreach_row = self.fake_db.save_outreach(
            prospect_id=prospect["id"], status="draft", email_subject="Hi", message="body"
        )
        approved = service.approve_outreach(outreach_row["id"])
        self.assertEqual(approved["status"], "approved")
        sent = service.mark_sent(outreach_row["id"])
        self.assertEqual(sent["status"], "sent")
        self.assertIsNotNone(sent["sent_at"])
        # the injected sender actually got called with the draft's real content
        self.assertEqual(len(sent_calls), 1)
        self.assertEqual(sent_calls[0]["to_email"], "co@x.com")
        self.assertEqual(sent_calls[0]["subject"], "Hi")
        self.assertEqual(sent_calls[0]["body"], "body")

    def test_mark_sent_rejects_a_draft_that_was_never_approved(self):
        service = PipelineService(send_email=lambda **kwargs: None)
        prospect = self.fake_db.save_prospect(
            run_id="r1", source_company_id="c1", company_name="Co",
            fit_score=0.9, match_level="high match", reason=None, company_email="co@x.com",
        )
        outreach_row = self.fake_db.save_outreach(prospect_id=prospect["id"], status="draft", email_subject="Hi", message="b")
        with self.assertRaises(ValueError):
            service.mark_sent(outreach_row["id"])

    def test_mark_sent_fails_gracefully_with_no_recipient_email(self):
        service = PipelineService(send_email=lambda **kwargs: None)
        prospect = self.fake_db.save_prospect(
            run_id="r1", source_company_id="c1", company_name="Co",
            fit_score=0.9, match_level="high match", reason=None, company_email=None,
        )
        outreach_row = self.fake_db.save_outreach(prospect_id=prospect["id"], status="approved", email_subject="Hi", message="b")
        result = service.mark_sent(outreach_row["id"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("email", result["status_reason"].lower())

    def test_mark_sent_records_failed_status_on_smtp_error(self):
        def broken_sender(**kwargs):
            raise EmailSendError("SMTP server refused the connection")

        service = PipelineService(send_email=broken_sender)
        prospect = self.fake_db.save_prospect(
            run_id="r1", source_company_id="c1", company_name="Co",
            fit_score=0.9, match_level="high match", reason=None, company_email="co@x.com",
        )
        outreach_row = self.fake_db.save_outreach(prospect_id=prospect["id"], status="approved", email_subject="Hi", message="b")
        result = service.mark_sent(outreach_row["id"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("SMTP server refused", result["status_reason"])

    def test_mark_sent_allows_retrying_a_failed_send_without_re_approval(self):
        # Regression test for: after a send fails (bad SMTP creds, a
        # transient network error, etc.) there was no way to retry it --
        # mark_sent only accepted status="approved", and a failed send
        # left the row at status="failed", a dead end. The draft content
        # was already approved once; retrying shouldn't require redoing
        # that step, just calling send again.
        calls = {"n": 0}

        def flaky_sender(**kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                raise EmailSendError("Connection timed out")
            # second attempt succeeds

        service = PipelineService(send_email=flaky_sender)
        prospect = self.fake_db.save_prospect(
            run_id="r1", source_company_id="c1", company_name="Co",
            fit_score=0.9, match_level="high match", reason=None, company_email="co@x.com",
        )
        outreach_row = self.fake_db.save_outreach(prospect_id=prospect["id"], status="approved", email_subject="Hi", message="b")

        first = service.mark_sent(outreach_row["id"])
        self.assertEqual(first["status"], "failed")

        retried = service.mark_sent(outreach_row["id"])
        self.assertEqual(retried["status"], "sent")
        self.assertEqual(calls["n"], 2)

    def test_mark_sent_propagates_not_configured_when_no_sender_injected(self):
        # No send_email override, no SMTP_USERNAME/PASSWORD set in this test
        # environment -- exercises the real default (app.integrations.email
        # .smtp_sender.send_email), confirming it's a clear, distinct error
        # rather than a silent "sent".
        service = PipelineService()
        prospect = self.fake_db.save_prospect(
            run_id="r1", source_company_id="c1", company_name="Co",
            fit_score=0.9, match_level="high match", reason=None, company_email="co@x.com",
        )
        outreach_row = self.fake_db.save_outreach(prospect_id=prospect["id"], status="approved", email_subject="Hi", message="b")
        with self.assertRaises(SmtpNotConfiguredError):
            service.mark_sent(outreach_row["id"])

    def test_discover_against_the_real_bundled_500_row_dataset(self):
        # No `companies=` override -> PipelineService loads Agent 2's real
        # vendored silah_data.csv (pure csv/stdlib, no LLM deps needed) and
        # runs the full discover() flow against actual company records, at
        # actual scale -- not a 5-row toy fixture.
        service = PipelineService()  # mock agents; real dataset
        result = service.discover(
            product_name="Cybersecurity Awareness Platform",
            product_description="A SaaS platform that trains employees to recognize phishing and social engineering.",
            sender_name="Nouf", sender_company_name="Silah",
            sender_email="nouf@silah.sa", sender_phone="+966500000000",
            preferred_city="Riyadh", requested_company_count=5,
        )
        self.assertEqual(result["status"], "ready")
        self.assertEqual(len(result["prospects"]), 5)
        for row in result["prospects"]:
            self.assertTrue(row["company_name"])
            self.assertIn(row["match_level"], {"high match", "medium match", "low match"})


class DefaultCompanyDatasetTests(unittest.TestCase):
    """load_default_companies() -- pure csv/stdlib, no agent deps needed --
    against the real file shipped in vendor/agent2_qualification/."""

    def test_loads_the_real_bundled_dataset(self):
        companies = load_default_companies()
        self.assertEqual(len(companies), 500)
        sample = companies[0]
        for field in ("company_id", "company_name", "industry", "location",
                      "business_description", "email", "revenue_sar"):
            self.assertIn(field, sample)
        # every row has the two fields the loader guarantees are never blank
        self.assertTrue(all(c["company_id"] and c["company_name"] for c in companies))


class SupabaseDatabaseContractTests(unittest.TestCase):
    """app/integrations/supabase/database.py itself -- the parts that don't
    need a live Supabase project: status validation and the env-var-only
    credential check (SupabaseConfigError, never a hardcoded fallback)."""

    def test_save_outreach_rejects_invalid_status(self):
        with self.assertRaises(ValueError):
            save_outreach(prospect_id="x", status="not_a_real_status")

    def test_update_outreach_status_rejects_invalid_status(self):
        with self.assertRaises(ValueError):
            update_outreach_status(outreach_id="x", status="bogus")

    def test_all_statuses_from_the_handoff_spec_are_valid(self):
        expected = {
            "not_sent", "draft", "approved", "sent", "failed",
            "replied", "not_interested", "meeting_requested",
        }
        self.assertEqual(VALID_OUTREACH_STATUSES, expected)

    def test_get_client_without_env_vars_raises_config_error_not_a_crash(self):
        get_client.cache_clear()
        with self.assertRaises(SupabaseConfigError):
            get_client()


class RealAdapterImportShapeTests(unittest.TestCase):
    """Confirm the real_*.py adapter MODULES import cleanly with zero
    third-party agent dependencies installed (they only import pydantic-only
    code at module level; vendor imports are deferred into __init__) -- and
    that constructing one without those dependencies fails with a clear,
    expected error rather than something confusing."""

    def test_real_fit_module_imports_without_langchain_or_openai(self):
        from app.agents.adapters.real_fit import RealFitAgent, _to_vendor_company

        self.assertTrue(callable(_to_vendor_company))
        mapped = _to_vendor_company({"id": "1", "name": "Acme", "annual_revenue": 500000})
        self.assertEqual(mapped["company_id"], "1")
        self.assertEqual(mapped["company_name"], "Acme")
        self.assertEqual(mapped["revenue_sar"], 500000)
        self.assertIsInstance(RealFitAgent, type)  # class itself constructed fine

    def test_real_fit_agent_construction_fails_clearly_without_deps(self):
        from app.agents.adapters.real_fit import RealFitAgent

        with self.assertRaises(ModuleNotFoundError):
            RealFitAgent()  # tenacity/openai not installed here -- expected

    def test_real_product_and_outreach_modules_import_cleanly(self):
        from app.agents.adapters.real_outreach import RealOutreachAgent
        from app.agents.adapters.real_product import RealProductAgent

        self.assertIsInstance(RealProductAgent, type)
        self.assertIsInstance(RealOutreachAgent, type)

    def test_real_fit_agent_caps_eligible_companies_to_requested_top_n(self):
        # Regression test for: requesting 5 companies from the real agent
        # returned 20. evaluation_log holds one "scored" entry per company
        # that reached Stage 2 (capped at LLM_PREFILTER_TOP_N=20, not at
        # the caller's top_n -- see real_fit.py's _cap_to_top_n docstring).
        # This exercises the capping logic directly, with no vendor deps.
        from app.agents.adapters.real_fit import RealFitAgent

        def scored(company_id, score):
            return RankedCompany(
                company_id=company_id, company_name=f"Co {company_id}",
                eligible=True, total_score=score, coverage=1.0,
                fit_label="high match", factors=[],
            )

        # 20 companies "scored" by the pre-filter shortlist (as the real
        # evaluation_log would produce), scores intentionally out of order.
        companies = [scored(str(i), score=float(i)) for i in range(20)]

        capped = RealFitAgent._cap_to_top_n(companies, top_n=5)

        still_eligible = [c for c in capped if c.eligible]
        self.assertEqual(len(still_eligible), 5)
        # the 5 highest scores (15..19) are the ones kept
        self.assertEqual({c.company_id for c in still_eligible}, {"15", "16", "17", "18", "19"})
        # the other 15 are demoted, not dropped -- same list length as input
        self.assertEqual(len(capped), 20)
        demoted = [c for c in capped if not c.eligible]
        self.assertEqual(len(demoted), 15)
        self.assertTrue(all(c.exclusion_reason == "rank" for c in demoted))

    def test_real_fit_agent_cap_leaves_already_ineligible_companies_untouched(self):
        from app.agents.adapters.real_fit import RealFitAgent

        eligible = RankedCompany(
            company_id="1", company_name="Co 1", eligible=True,
            total_score=0.9, coverage=1.0, fit_label="high match", factors=[],
        )
        already_excluded = RankedCompany(
            company_id="2", company_name="Co 2", eligible=False,
            exclusion_reason="revenue", total_score=None, coverage=0.0, factors=[],
        )
        capped = RealFitAgent._cap_to_top_n([eligible, already_excluded], top_n=5)
        self.assertEqual(len(capped), 2)
        self.assertTrue(capped[0].eligible)
        self.assertFalse(capped[1].eligible)
        self.assertEqual(capped[1].exclusion_reason, "revenue")  # untouched, not overwritten to "rank"

    def test_real_fit_agent_cap_is_a_noop_when_fewer_eligible_than_top_n(self):
        from app.agents.adapters.real_fit import RealFitAgent

        companies = [
            RankedCompany(company_id=str(i), company_name=f"Co {i}", eligible=True,
                          total_score=float(i), coverage=1.0, factors=[])
            for i in range(3)
        ]
        capped = RealFitAgent._cap_to_top_n(companies, top_n=5)
        self.assertTrue(all(c.eligible for c in capped))


class ResilienceRetryTests(unittest.TestCase):
    """app/core/resilience.py's retry_on_transient_network_error --
    regression coverage for: httpx.ReadError ([WinError 10035]) and
    httpx.LocalProtocolError ("Invalid input ConnectionInputs.RECV_DATA in
    state ConnectionState.CLOSED") crashing Supabase/LLM calls outright
    when a pooled connection went stale. Patches time.sleep so the
    backoff delays don't actually slow down the test run."""

    def setUp(self):
        import httpx

        from app.core.resilience import retry_on_transient_network_error

        self.httpx = httpx
        self.retry_on_transient_network_error = retry_on_transient_network_error
        self._sleep_patcher = unittest.mock.patch("app.core.resilience.time.sleep")
        self._sleep_patcher.start()
        self.addCleanup(self._sleep_patcher.stop)

    def test_retries_and_recovers_from_a_transient_transport_error(self):
        calls = {"n": 0}

        @self.retry_on_transient_network_error
        def flaky():
            calls["n"] += 1
            if calls["n"] < 3:
                raise self.httpx.LocalProtocolError(
                    "Invalid input ConnectionInputs.RECV_DATA in state ConnectionState.CLOSED"
                )
            return "ok"

        self.assertEqual(flaky(), "ok")
        self.assertEqual(calls["n"], 3)

    def test_gives_up_and_reraises_after_max_attempts(self):
        calls = {"n": 0}

        @self.retry_on_transient_network_error
        def always_broken():
            calls["n"] += 1
            raise self.httpx.ReadError("[WinError 10035] non-blocking socket op")

        with self.assertRaises(self.httpx.ReadError):
            always_broken()
        self.assertEqual(calls["n"], 4)  # _MAX_ATTEMPTS

    def test_does_not_retry_a_non_transport_error(self):
        calls = {"n": 0}

        @self.retry_on_transient_network_error
        def real_failure():
            calls["n"] += 1
            raise ValueError("bad request, not a connection problem")

        with self.assertRaises(ValueError):
            real_failure()
        self.assertEqual(calls["n"], 1)  # never retried


class SmtpSenderTests(unittest.TestCase):
    """app/integrations/email/smtp_sender.py -- the env-var-only credential
    check (SmtpNotConfiguredError, never a hardcoded fallback), matching
    the same pattern already used for Supabase/LLM credentials."""

    def test_send_email_without_credentials_raises_config_error_not_a_crash(self):
        with self.assertRaises(SmtpNotConfiguredError):
            send_email(to_email="a@b.com", subject="Hi", body="Hello")


if __name__ == "__main__":
    unittest.main(verbosity=2)
