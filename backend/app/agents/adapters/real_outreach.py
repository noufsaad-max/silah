 """
Adapter wrapping the real Outreach Agent vendored from
ghadahHameed/silah-multi-agent-SDA (branch agent-3). See
app/agents/vendor/agent3_outreach/ and vendor/CHANGES.md.

Deliberately does NOT call outreach_agent.run_outreach_agent(): that
function blocks on input("Do you approve sending this email? (y/n): ") and
sends live SMTP mail, neither of which belongs in a web request handler.
Instead this adapter reuses outreach_agent.chain (the
prompt | llm_with_tools pipeline) to draft the email, extracts the
send_email_tool call's arguments, and stops -- approval and sending are
owned by the backend's own outreach endpoints, not by the agent.

Vendor code is imported lazily (inside __init__) so importing this file
never eagerly constructs an LLM client -- only using the adapter does.
"""
from app.agents.interfaces import OutreachAgent
from app.agents.schemas import DraftMessage, OutreachRequest
from app.core.resilience import retry_on_transient_network_error


class RealOutreachAgent(OutreachAgent):
    def __init__(self):
        from app.agents.vendor.agent3_outreach.outreach_agent import chain

        self._chain = chain

    def run(self, request: OutreachRequest) -> DraftMessage:
        if not request.company_email:
            return DraftMessage(
                subject=None,
                body=None,
                status="needs_review",
                status_reason="Missing company email. Needs human review.",
            )

        response = self._invoke_chain(request)

        for tool_call in getattr(response, "tool_calls", None) or []:
            if tool_call.get("name") == "send_email_tool":
                subject = tool_call["args"].get("subject")
                body = tool_call["args"].get("body")
                if subject and body:
                    return DraftMessage(
                        subject=subject,
                        body=body,
                        status="drafted",
                        status_reason="Drafted by the Outreach Agent; awaiting human approval.",
                    )
                return DraftMessage(
                    subject=subject,
                    body=body,
                    status="needs_review",
                    status_reason="Outreach Agent produced an incomplete draft (missing subject or body).",
                )

        return DraftMessage(
            subject=None,
            body=None,
            status="needs_review",
            status_reason="Outreach Agent did not produce a draft.",
        )

    @retry_on_transient_network_error
    def _invoke_chain(self, request: OutreachRequest):
        # Isolated in its own retried method so only the actual outbound
        # LLM call is retried, not the tool-call parsing above -- see
        # app/core/resilience.py for why this retry exists at all.
        return self._chain.invoke(
            {
                "product_name": request.product_name,
                "company_name": request.company_name,
                "company_email": request.company_email,
                "sender_name": request.sender_name,
                "sender_company": request.sender_company,
                "sender_email": request.sender_email,
                "sender_phone": request.sender_phone,
            }
        )
