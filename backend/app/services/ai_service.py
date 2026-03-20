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
        "5) Treat identifier-like columns (e.g., columns containing 'id', 'rollno', 'user_id') as keys/labels: "
        "do NOT use them as ranking/measure columns unless the question explicitly asks for them. "
        "6) You may use ORDER BY, LIMIT, GROUP BY, MIN, MAX, COUNT, and safe aggregates. "
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
    Deterministic, semantic insights based on the dataset’s chosen primary columns.
    This avoids “fake trends” and unrelated charts by deriving insights from computed metrics.
    """

    chosen_cat = summary.get("chosen_categorical_column")
    chosen_num = summary.get("chosen_numeric_column")
    has_time_series = bool(summary.get("has_time_series"))

    def _fmt_value(v: Any) -> str | None:
        if v is None:
            return None
        try:
            # Keep integers readable (e.g., 100.0 -> 100).
            f = float(v)
            if abs(f - round(f)) < 1e-9:
                return str(int(round(f)))
            return str(round(f, 4)).rstrip("0").rstrip(".")
        except Exception:
            return str(v)

    # Semantic validation layer.
    def _is_meaningful_sentence(s: str) -> bool:
        lower = s.lower()
        if "trend is" in lower:
            return has_time_series  # only allow trend text if time series exists (we generally don't emit it)
        # Very lightweight guard against identifier-like wording.
        forbidden = ["rollno", "roll_no", "user_id", "id", "uuid", "guid"]
        return not any(x in lower for x in forbidden)

    insights: list[str] = []
    if chosen_cat and chosen_num:
        top_label = summary.get("top_label")
        top_value = _fmt_value(summary.get("top_value"))
        bottom_label = summary.get("bottom_label")
        bottom_value = _fmt_value(summary.get("bottom_value"))
        avg_value = _fmt_value(summary.get("avg_value"))
        ranking = summary.get("ranking") if isinstance(summary.get("ranking"), list) else []

        if top_label and top_value is not None:
            insights.append(
                f"Top scorer is {top_label} with {top_value} {chosen_num}"
            )
        if bottom_label and bottom_value is not None:
            insights.append(
                f"Lowest scorer is {bottom_label} with {bottom_value} {chosen_num}"
            )
        if avg_value is not None:
            insights.append(f"Average {chosen_num} is {avg_value}")

        if ranking:
            top_items = [r for r in ranking if isinstance(r, dict) and r.get("label") and r.get("value") is not None][:5]
            if top_items:
                parts = []
                for r in top_items:
                    v = _fmt_value(r.get("value"))
                    if v is None:
                        continue
                    parts.append(f"{r['label']} ({v})")
                if parts:
                    insights.append(f"Top ranking: {', '.join(parts)}")

    # Filter out anything that looks meaningless.
    insights = [s for s in insights if _is_meaningful_sentence(s)]

    # Fallback: at least provide an average if we couldn’t compute ranking (still avoids “fake trends”).
    if not insights:
        numeric_stats = summary.get("numeric_stats") if isinstance(summary.get("numeric_stats"), dict) else {}
        numeric_columns = summary.get("numeric_columns") if isinstance(summary.get("numeric_columns"), list) else []
        if numeric_columns:
            col = numeric_columns[0]
            stats = numeric_stats.get(col) if isinstance(numeric_stats.get(col), dict) else None
            if stats and stats.get("mean_val") is not None:
                mean_v = _fmt_value(stats.get("mean_val"))
                if mean_v is not None:
                    insights.append(f"Average {col} is {mean_v}")

    return insights[:5]

