FROM python:3.12-slim
RUN pip install --no-cache-dir --default-timeout=180 --retries 10 pymupdf==2.0 openpyxl==3.1.5
COPY extract_catalogue.py /app/extract_catalogue.py
ENTRYPOINT ["python", "-I", "/app/extract_catalogue.py"]
