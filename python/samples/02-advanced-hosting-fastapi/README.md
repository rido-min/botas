# Advanced Hosting — FastAPI

**Category:** 2 — Advanced Hosting  
**Language:** Python  
**Complexity:** Intermediate

## What This Sample Demonstrates

- Using botas with **FastAPI** for full async web server control
- The `botas-fastapi` adapter for seamless integration
- That botas is web server agnostic — works with any Python framework

## Prerequisites

- Python 3.11+
- No Azure credentials needed for local testing

## Run

```bash
pip install -e .
uvicorn main:app --port 3978
```

## Key Files

- `main.py` — FastAPI server with botas integration

## Learn More

- [FastAPI docs](https://fastapi.tiangolo.com/)
- [Other hosting samples](../) — FastAPI, Flask
