"""
Shared retry helper for outbound network calls (LLM APIs, Supabase, ...)
that can fail with a transient, connection-level error that has nothing to
do with the request itself.

Background: real-agent/Supabase runs have hit crashes like

    httpx.ReadError: [WinError 10035] A non-blocking socket operation
    could not be completed immediately

    httpx.LocalProtocolError: Invalid input ConnectionInputs.RECV_DATA
    in state ConnectionState.CLOSED

Both are httpx.TransportError subclasses. They happen when a pooled
keep-alive HTTP connection gets silently closed between requests (an idle
timeout on the server side, a flaky Wi-Fi/VPN hop, antivirus HTTPS
inspection -- all common on a home Windows machine) and the next attempt
to reuse it fails at the transport level, before the request even reaches
the other side. It has nothing to do with the data being sent or the
service being called; simply retrying (httpx opens a fresh connection once
the broken one errors) succeeds.

`retry_on_transient_network_error` only catches httpx.TransportError and
its subclasses -- never a real application-level error (a bad request, an
auth failure, a validation error), which always raises a different
exception type and is never silently retried away.

Deliberately implemented with the standard library only (no `tenacity`
dependency), even though the real agents already pull tenacity in via
requirements-agents.txt for the vendored Agent 2 code. This decorator sits
on the import path of app/integrations/supabase/database.py, which
app/agents/service.py imports unconditionally at startup -- so it runs for
every install, including the plain SQLite/mock-agents quick-test path that
has neither requirements-agents.txt nor requirements-supabase.txt
installed. Requiring a new package there would defeat the whole point of
keeping that path dependency-free, and the retry logic itself is simple
enough that a hand-rolled version is no less reliable.

Used by:
  - app/integrations/supabase/database.py (_execute) -- every Supabase call
  - app/agents/adapters/real_product.py -- Agent 1's LLM call
  - app/agents/adapters/real_outreach.py -- Agent 3's LLM call
  (Agent 2's own LLM calls already retry via tenacity inside the vendored
  app/agents/vendor/agent2_qualification/scoring.py -- see vendor/CHANGES.md.)
"""
import random
import time
from functools import wraps
from typing import Callable, TypeVar

import httpx

_MAX_ATTEMPTS = 4
_BASE_DELAY_SECONDS = 0.5
_MAX_DELAY_SECONDS = 5.0

F = TypeVar("F", bound=Callable)


def retry_on_transient_network_error(func: F) -> F:
    """Decorator: retry `func` up to _MAX_ATTEMPTS times, with jittered
    exponential backoff, ONLY on httpx.TransportError (and subclasses).
    Any other exception -- including a real API/application error -- is
    raised immediately on the first attempt, unchanged.
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        attempt = 0
        while True:
            attempt += 1
            try:
                return func(*args, **kwargs)
            except httpx.TransportError:
                if attempt >= _MAX_ATTEMPTS:
                    raise
                delay = min(_MAX_DELAY_SECONDS, _BASE_DELAY_SECONDS * (2 ** (attempt - 1)))
                time.sleep(delay * (0.5 + random.random()))

    return wrapper
