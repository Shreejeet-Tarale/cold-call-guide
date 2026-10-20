
from fastapi import FastAPI

app = FastAPI(
    title="Cold Call Guide API",
    description="Backend API for the Live Cold Call Guide",
    version="0.1.0",
)


@app.get("/")
def home():
    return {
        "message": "Cold Call Guide API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "cold-call-guide-api",
    }
