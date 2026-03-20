import json
import re
from typing import Any

from fastapi import HTTPException, status
from openai import OpenAI

from app.utils.config import settings


def _strip_code_fences(text: str) -> str:
    return re.sub(
        r"^```(?:json)?\s*|```$",
        "",
        text.strip(),
        flags=re.IGNORECASE | re.MULTILINE,
    )


def _parse_sql_json(content: str) -> dict[str, Any]:
    try:
        return json.loads(_strip_code_fences(content))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI response parsing failed: {e}",
        )


def generate_sql_and_explanation(*, question: str, table_schema: str) -> tuple[str, str]:
    """
    Returns (sql, explanation).

    The caller must validate SQL safety before execution.
    """
    client = OpenAI(api_key=settings.openai_api_key)

    system_prompt = (
        "You are a data analyst that writes DuckDB SQL. "
        "Rules (strict): "
        "1) Generate ONLY a single read-only SQL query of type SELECT (or a WITH CTE that selects). "
        "2) The generated SQL MUST start with SELECT or WITH and MUST NOT include any other text. "
        "3) Do not use multiple statements; do not include a trailing semicolon. "
        "4) Use ONLY the table `dataset` that matches the provided schema. "
        "5) You may use ORDER BY, LIMIT, GROUP BY, MIN, MAX, COUNT, and safe aggregates. "
        "If the question needs a column that doesn't exist, use the closest match (based on similarity) "
        "or explain what to clarify in the explanation. "
        "Return STRICT JSON with keys: sql, explanation."
    )

    user_prompt = (
        f"Question:\n{question}\n\n"
        f"Table schema (DuckDB types):\n{table_schema}\n\n"
        "Return JSON:"
        '{ "sql": "<SQL using dataset>", "explanation": "<human readable explanation>" }'
    )

    resp = client.chat.completions.create(
        model=settings.openai_model,
        temperature=0.1,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = resp.choices[0].message.content or ""
    parsed = _parse_sql_json(content)
    sql = str(parsed.get("sql") or "").strip()
    explanation = str(parsed.get("explanation") or "").strip()

    if not sql:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="AI could not generate a SQL query. Please rephrase.",
        )

    return sql, explanation


def generate_ai_insights(*, summary: dict[str, Any], suggested_charts: list[dict[str, Any]]) -> list[str]:
    """
    Generates human-readable insights (not raw SQL) from summary statistics + chart data.
    Returns a list of short sentences.
    """
    client = OpenAI(api_key=settings.openai_api_key)

    system_prompt = (
        "You are a data analyst for an AI spreadsheet app. "
        "Generate concise insights for the user based on the provided summary stats and chart data. "
        "Return STRICT JSON: { \"insights\": [\"...\"] }. "
        "Rules: Include at least one sentence that follows the format `Top category is X` (based on bar/pie charts). "
        "If the line chart shows a clear direction, include one sentence that follows `Trend is increasing` or `Trend is decreasing`. "
        "Keep each insight under 200 characters."
    )

    user_prompt = (
        f"Summary stats:\n{summary}\n\n"
        f"Suggested charts (with already computed data):\n{json.dumps(suggested_charts, ensure_ascii=False)}\n\n"
        "Create 3 to 5 insights."
    )

    resp = client.chat.completions.create(
        model=settings.openai_model,
        temperature=0.3,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = resp.choices[0].message.content or ""
    parsed = _parse_sql_json(content)
    insights = parsed.get("insights")
    if not isinstance(insights, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI insights response format invalid.",
        )

    return [str(x) for x in insights[:5]]

