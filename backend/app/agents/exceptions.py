"""
Exceptions raised by agent adapters. Defined here (not imported from a
vendor agent's own module) so callers never need to import vendor code
directly just to catch an error -- see docs/01-architecture.md.
"""


class AgentClarificationNeeded(Exception):
    """
    Raised when an agent cannot proceed without more information from the
    user -- e.g. a product description that doesn't say who the target
    buyer is. Callers should surface `prompt_for_user` to the person and
    retry with their answer appended to the original description, rather
    than treating this as a failure.
    """

    def __init__(self, reason: str, prompt_for_user: str | None = None):
        self.reason = reason
        self.prompt_for_user = prompt_for_user
        super().__init__(reason)
