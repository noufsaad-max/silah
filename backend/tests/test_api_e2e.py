 """
Real end-to-end test of the actual FastAPI app: register -> login -> me ->
onboarding -> the full agent pipeline over real HTTP requests (via
FastAPI's TestClient, which runs the real ASGI app in-process -- this is
not a mock of the app, it IS the app), against a throwaway SQLite file.

Needs the full base dependency set (requirements.txt) -- this is the piece
that could NOT be executed in the sandbox that built this repo (no PyPI
access there). Run this on a machine with real internet access to get a
real pass/fail on the whole stack, including the parts sandbox-side
verification (tests/test_pipeline_offline.py) couldn't reach: FastAPI
routing, request validation, the JWT auth dependency chain, and SQLAlchemy
against a real file.

Uses the mock agents throughout (use_real_agents defaults to false), so no
LLM_API_KEY / SILAH_OPENAI_API_KEY / SUPABASE_URL / SUPABASE_KEY is needed
to run this file -- it proves the HTTP layer and the SQLite auth database
work, independent of whether the real agents/Supabase are configured.

Run with (from backend/, after `pip install -r requirements.txt`):
    python -m pytest tests/test_api_e2e.py -v
or:
    python -m unittest tests.test_api_e2e -v
"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Point DATABASE_URL at a throwaway file BEFORE anything under app/ is
# imported -- app/db/session.py builds its engine at import time from
# app.core.config.settings, which is itself built at import time from the
# environment. Importing app.main (or anything upstream of it) first would
# bind the engine to whatever DATABASE_URL happened to be set to already.
_TMP_DB = Path(tempfile.gettempdir()) / "silah_test_e2e.db"
if _TMP_DB.exists():
    _TMP_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ["JWT_SECRET"] = "test-only-secret"
os.environ.setdefault("CORS_ORIGINS", '["http://localhost:3000"]')

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402

Base.metadata.create_all(bind=engine)
client = TestClient(app)


class AuthFlowTests(unittest.TestCase):
    """The same flow the frontend already drives for real (register/login/
    me/onboarding) -- re-verified here against this exact copy of the app."""

    def test_register_login_me_onboarding_round_trip(self):
        register = client.post(
            "/api/v1/auth/register",
            json={
                "workspace_name": "Test Co",
                "name": "Test User",
                "email": "e2e-auth@example.com",
                "password": "testpass123",
            },
        )
        self.assertEqual(register.status_code, 201, register.text)
        token = register.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "e2e-auth@example.com", "password": "testpass123"},
        )
        self.assertEqual(login.status_code, 200, login.text)

        me = client.get("/api/v1/auth/me", headers=headers)
        self.assertEqual(me.status_code, 200, me.text)
        self.assertEqual(me.json()["email"], "e2e-auth@example.com")

        onboarding = client.post(
            "/api/v1/onboarding/complete",
            headers=headers,
            json={
                "name": "Test User",
                "job_title": "Founder",
                "phone": "+966500000000",
                "company_name": "Test Co",
                "industry": "Technology",
                "website": "https://test.co",
                "country": "Saudi Arabia",
                "city": "Riyadh",
                "company_description": "A test company.",
            },
        )
        self.assertEqual(onboarding.status_code, 200, onboarding.text)

    def test_wrong_password_is_rejected(self):
        client.post(
            "/api/v1/auth/register",
            json={
                "workspace_name": "Co2", "name": "U2",
                "email": "e2e-wrongpw@example.com", "password": "correct-horse-1",
            },
        )
        bad_login = client.post(
            "/api/v1/auth/login",
            json={"email": "e2e-wrongpw@example.com", "password": "wrong-password"},
        )
        self.assertEqual(bad_login.status_code, 401)

    def test_protected_route_without_token_is_rejected(self):
        response = client.get("/api/v1/auth/me")
        self.assertEqual(response.status_code, 401)


class PipelineHttpTests(unittest.TestCase):
    """The new agent-pipeline routes over real HTTP, with the mock agents
    (no LLM keys needed) -- proves api/v1/routes/pipeline.py, PipelineService
    and the FastAPI dependency injection chain all fit together correctly.
    Supabase calls are stubbed the same way tests/test_pipeline_offline.py
    stubs them, since no live Supabase project is available in CI/sandbox.
    """

    @classmethod
    def setUpClass(cls):
        register = client.post(
            "/api/v1/auth/register",
            json={
                "workspace_name": "Pipeline Co", "name": "Pipeline User",
                "email": "e2e-pipeline@example.com", "password": "testpass123",
            },
        )
        cls.headers = {"Authorization": f"Bearer {register.json()['access_token']}"}

        import app.agents.service as service_module

        # app/api/v1/routes/pipeline.py does `from app.integrations.supabase
        # import database as db` too -- same module object, so patching
        # attributes here is visible there as well; no separate patch needed.
        cls._orig = {
            name: getattr(service_module.db, name)
            for name in (
                "save_product", "create_run", "save_prospect",
                "save_outreach", "update_outreach_status", "get_prospect",
                "get_products", "get_product", "get_run", "get_runs_for_product",
                "get_prospects_for_run", "get_outreach_for_prospect", "get_outreach",
            )
        }
        # PipelineService() (constructed fresh by the /send route) defaults
        # to this module-level name for actually sending mail -- patch it to
        # a no-op recorder so this test doesn't need real SMTP credentials
        # or hit a real mail server. See app/agents/service.py.
        cls._orig_send_email = service_module._send_email
        cls.sent_emails = []
        service_module._send_email = lambda **kwargs: cls.sent_emails.append(kwargs)

        class _Fake:
            def __init__(self):
                self._id = 0
                self.rows = {"products": [], "runs": [], "prospects": [], "outreach": []}

            def _nid(self):
                self._id += 1
                return f"id-{self._id}"

            def save_product(self, **kw):
                row = {"id": self._nid(), **kw}
                self.rows["products"].append(row)
                return row

            def create_run(self, **kw):
                row = {"id": self._nid(), **kw}
                self.rows["runs"].append(row)
                return row

            def save_prospect(self, **kw):
                row = {"id": self._nid(), **kw}
                self.rows["prospects"].append(row)
                return row

            def get_prospect(self, prospect_id):
                for row in self.rows["prospects"]:
                    if row["id"] == prospect_id:
                        return row
                return None

            def save_outreach(self, **kw):
                row = {"id": self._nid(), **{"reply_status": None, "sent_at": None, **kw}}
                self.rows["outreach"].append(row)
                return row

            def update_outreach_status(self, outreach_id, status, status_reason=None, sent_at=None):
                for row in self.rows["outreach"]:
                    if row["id"] == outreach_id:
                        row["status"] = status
                        return row
                raise RuntimeError("not found")

            # --- read side, for the aggregate/dashboard GET routes ---
            def get_products(self):
                return list(reversed(self.rows["products"]))

            def get_product(self, product_id):
                for row in self.rows["products"]:
                    if row["id"] == product_id:
                        return row
                return None

            def get_run(self, run_id):
                for row in self.rows["runs"]:
                    if row["id"] == run_id:
                        return row
                return None

            def get_runs_for_product(self, product_id):
                return [r for r in self.rows["runs"] if r["product_id"] == product_id]

            def get_prospects_for_run(self, run_id):
                return [p for p in self.rows["prospects"] if p["run_id"] == run_id]

            def get_outreach_for_prospect(self, prospect_id):
                return [o for o in reversed(self.rows["outreach"]) if o["prospect_id"] == prospect_id]

            def get_outreach(self, outreach_id):
                for row in self.rows["outreach"]:
                    if row["id"] == outreach_id:
                        return row
                return None

        cls._fake = _Fake()
        service_module.db.save_product = cls._fake.save_product
        service_module.db.create_run = cls._fake.create_run
        service_module.db.save_prospect = cls._fake.save_prospect
        service_module.db.save_outreach = cls._fake.save_outreach
        service_module.db.update_outreach_status = cls._fake.update_outreach_status
        service_module.db.get_prospect = cls._fake.get_prospect
        service_module.db.get_products = cls._fake.get_products
        service_module.db.get_product = cls._fake.get_product
        service_module.db.get_run = cls._fake.get_run
        service_module.db.get_runs_for_product = cls._fake.get_runs_for_product
        service_module.db.get_prospects_for_run = cls._fake.get_prospects_for_run
        service_module.db.get_outreach_for_prospect = cls._fake.get_outreach_for_prospect
        service_module.db.get_outreach = cls._fake.get_outreach

    @classmethod
    def tearDownClass(cls):
        import app.agents.service as service_module

        for name, fn in cls._orig.items():
            setattr(service_module.db, name, fn)
        service_module._send_email = cls._orig_send_email

    def test_discover_runs_mock_agents_and_returns_prospects(self):
        response = client.post(
            "/api/v1/pipeline/discover",
            headers=self.headers,
            json={
                "product_name": "Cybersecurity Awareness Platform",
                "product_description": "Trains employees to recognize phishing and social engineering.",
                "sender_name": "Nouf", "sender_company_name": "Silah",
                "sender_email": "nouf@silah.sa", "sender_phone": "+966500000000",
                "preferred_city": "Riyadh", "requested_company_count": 3,
                "companies": [
                    {"company_id": "1", "company_name": "Acme Corp", "email": "a@acme.com"},
                    {"company_id": "2", "company_name": "Beta LLC", "email": "b@beta.com"},
                    {"company_id": "3", "company_name": "Gamma Inc", "email": None},
                ],
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["status"], "ready")
        self.assertEqual(len(body["prospects"]), 3)

    def test_discover_without_auth_is_rejected(self):
        response = client.post("/api/v1/pipeline/discover", json={})
        self.assertEqual(response.status_code, 401)

    def test_full_draft_approve_send_flow(self):
        prospect = self._fake.save_prospect(
            run_id="run-1", source_company_id="c1", company_name="Acme Corp",
            fit_score=0.8, match_level="high match", reason="good fit",
            company_email="a@acme.com", research_status="scored",
        )
        draft = client.post(
            f"/api/v1/pipeline/prospects/{prospect['id']}/draft-outreach",
            headers=self.headers,
            json={
                "product_name": "Widget",
                "sender": {"name": "A", "company_name": "B", "email": "a@b.com", "phone": "1"},
            },
        )
        self.assertEqual(draft.status_code, 200, draft.text)
        outreach_id = draft.json()["id"]
        self.assertEqual(draft.json()["status"], "draft")

        approve = client.post(f"/api/v1/pipeline/outreach/{outreach_id}/approve", headers=self.headers)
        self.assertEqual(approve.status_code, 200, approve.text)
        self.assertEqual(approve.json()["status"], "approved")

        send = client.post(f"/api/v1/pipeline/outreach/{outreach_id}/send", headers=self.headers)
        self.assertEqual(send.status_code, 200, send.text)
        self.assertEqual(send.json()["status"], "sent")
        # actually went through PipelineService.mark_sent's send path (the
        # patched no-op sender), not just a status flip
        self.assertEqual(len(self.sent_emails), 1)
        self.assertEqual(self.sent_emails[0]["to_email"], "a@acme.com")

    def test_send_is_rejected_before_approval(self):
        prospect = self._fake.save_prospect(
            run_id="run-2", source_company_id="c2", company_name="Beta LLC",
            fit_score=0.7, match_level="medium match", reason="ok fit",
            company_email="b@beta.com", research_status="scored",
        )
        outreach = self._fake.save_outreach(
            prospect_id=prospect["id"], status="draft", email_subject="Hi", message="body",
        )
        # never approved -- /send should refuse with 422, not silently send
        send = client.post(f"/api/v1/pipeline/outreach/{outreach['id']}/send", headers=self.headers)
        self.assertEqual(send.status_code, 422, send.text)

    def test_aggregate_and_join_routes(self):
        product = self._fake.save_product(
            product_name="Widget", product_description="d", sender_name="A",
            sender_company_name="B", sender_email="a@b.com", sender_phone="1",
        )
        run = self._fake.create_run(product_id=product["id"], preferred_city="Riyadh", requested_company_count=1)
        prospect = self._fake.save_prospect(
            run_id=run["id"], source_company_id="c9", company_name="Delta Co",
            fit_score=0.9, match_level="high match", reason="great fit",
            company_email="d@delta.com", research_status="scored",
        )
        self._fake.save_outreach(
            prospect_id=prospect["id"], status="sent", status_reason="approved and sent",
            email_subject="Hello Delta", message="body text",
        )

        prospect_detail = client.get(f"/api/v1/pipeline/prospects/{prospect['id']}", headers=self.headers)
        self.assertEqual(prospect_detail.status_code, 200, prospect_detail.text)
        self.assertEqual(prospect_detail.json()["company_name"], "Delta Co")
        self.assertEqual(prospect_detail.json()["product"]["id"], product["id"])
        self.assertEqual(prospect_detail.json()["product"]["product_name"], "Widget")

        missing_prospect = client.get("/api/v1/pipeline/prospects/does-not-exist", headers=self.headers)
        self.assertEqual(missing_prospect.status_code, 404)

        product_detail = client.get(f"/api/v1/pipeline/products/{product['id']}", headers=self.headers)
        self.assertEqual(product_detail.status_code, 200)
        self.assertEqual(product_detail.json()["product_name"], "Widget")

        missing_product = client.get("/api/v1/pipeline/products/does-not-exist", headers=self.headers)
        self.assertEqual(missing_product.status_code, 404)

        joined = client.get(f"/api/v1/pipeline/runs/{run['id']}/prospects-with-outreach", headers=self.headers)
        self.assertEqual(joined.status_code, 200, joined.text)
        row = next(r for r in joined.json() if r["id"] == prospect["id"])
        self.assertEqual(row["outreach_status"], "sent")
        self.assertEqual(row["email_subject"], "Hello Delta")

        all_prospects = client.get("/api/v1/pipeline/prospects", headers=self.headers)
        self.assertEqual(all_prospects.status_code, 200)
        matched = [r for r in all_prospects.json() if r["id"] == prospect["id"]]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0]["product_name"], "Widget")

        all_outreach = client.get("/api/v1/pipeline/outreach", headers=self.headers)
        self.assertEqual(all_outreach.status_code, 200)
        matched_outreach = [r for r in all_outreach.json() if r["company_name"] == "Delta Co"]
        self.assertEqual(len(matched_outreach), 1)
        self.assertEqual(matched_outreach[0]["status"], "sent")
        self.assertEqual(matched_outreach[0]["product_name"], "Widget")


if __name__ == "__main__":
    unittest.main(verbosity=2)
