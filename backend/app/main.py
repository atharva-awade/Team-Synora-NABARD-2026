"""
Pravah API -- AI-driven cash-flow prediction & risk flagging for rural
micro-enterprises (NABARD Hackathon @ GFF 2026).
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router

app = FastAPI(
    title="Pravah API",
    description="AI-driven cash-flow prediction & risk flagging for rural micro-enterprises.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"service": "Pravah API", "docs": "/docs", "health": "/api/health"}
