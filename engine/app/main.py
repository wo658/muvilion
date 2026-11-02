from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, plans

app = FastAPI(title="Drawing Preparation", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (health, plans):
    app.include_router(module.router)
