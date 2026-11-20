 FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt requirements-postgres.txt requirements-agents.txt requirements-supabase.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-postgres.txt
# The agent pipeline's own dependencies (langchain, sentence-transformers,
# supabase, etc.) are heavy and optional -- most of this image's users won't
# call the real agents. Installed by default here for a working `docker
# compose up` out of the box; drop the next line (and requirements-agents.txt
# / requirements-supabase.txt above) for a lighter auth-only image.
RUN pip install --no-cache-dir -r requirements-agents.txt -r requirements-supabase.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
