FROM python:3.12-slim
RUN pip install --no-cache-dir --default-timeout=180 --retries 10 pandas==2.2.3 openpyxl==3.1.5
COPY caruno_import.py part_categories.py engines.py make_sql.py export_json.py product_names.py import_review.py \
     categories.csv category_groups.csv article_categories.csv /app/
WORKDIR /app
