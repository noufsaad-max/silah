"""
Abstract contracts for the three agents. Whatever your collaborators deliver
-- a Python module or an HTTP service -- gets wrapped in one adapter that
satisfies these interfaces. The orchestrator, scoring math, schema
validation and caching never change based on how the agent internals work.
See docs/01-architecture.md ("Agent integration contract").
"""
from abc import ABC, abstractmethod

from app.agents.schemas import (
    DraftMessage,
    FitRequest,
    ICPRequest,
    ICPResult,
    OutreachRequest,
    RankedCompany,
)
 

class ProductAgent(ABC):
    @abstractmethod
    def run(self, request: ICPRequest) -> ICPResult: ...


class FitAgent(ABC):
    @abstractmethod
    def run(self, request: FitRequest) -> list[RankedCompany]: ...


class OutreachAgent(ABC):
    @abstractmethod
    def run(self, request: OutreachRequest) -> DraftMessage: ...
