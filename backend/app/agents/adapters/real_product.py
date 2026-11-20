"""
Adapter wrapping the real Product/ICP Agent vendored from
ghadahHameed/silah-multi-agent-SDA (branch agent-1). See
app/agents/vendor/agent1_product/ and vendor/CHANGES.md.

Vendor code is imported lazily (inside __init__), not at module load time.
app/agents/vendor/agent1_product/product_agent.py builds a `ChatOpenAI(...)`
client at module import time (a module-level global, not inside a
function), so importing that module requires LLM_MODEL/LLM_API_KEY to
resolve to something the OpenAI client accepts -- deferring the import
until RealProductAgent() is actually constructed keeps MockProductAgent the
zero-config default.
"""
from app.agents.interfaces import ProductAgent
from app.agents.schemas import ICPRequest, ICPResult, SearchPreferences
from app.core.resilience import retry_on_transient_network_error


class RealProductAgent(ProductAgent):
    def __init__(self):
        from app.agents.vendor.agent1_product.product_agent import analyze_product

        self._analyze_product = analyze_product

    def run(self, request: ICPRequest) -> ICPResult:
        prefs = request.search_preferences or SearchPreferences()
        output = self._call_analyze_product(request, prefs)
        # output is agent1's own Agent1Output pydantic model; re-validate
        # into our schema rather than trusting the vendor shape unchanged.
        return ICPResult(
            status=output.status,
            icp_industries=output.icp_industries,
            buyer_profile=output.buyer_profile,
            sender_info=request.sender_info,
            search_preferences=prefs,
            clarification_question=output.clarification_question,
        )

    @retry_on_transient_network_error
    def _call_analyze_product(self, request: ICPRequest, prefs: SearchPreferences):
        # Isolated in its own retried method (rather than decorating run()
        # itself) so only the actual outbound LLM call is retried, not any
        # of the response validation/mapping above -- see
        # app/core/resilience.py for why this retry exists at all.
        return self._analyze_product(
            product_name=request.product_name,
            product_description=request.product_description,
            sender_name=request.sender_info.name,
            sender_company_name=request.sender_info.company_name,
            sender_email=request.sender_info.email,
            sender_phone=request.sender_info.phone,
            preferred_city=prefs.preferred_city,
            requested_company_count=prefs.requested_company_count,
        )
