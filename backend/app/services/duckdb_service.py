import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import duckdb
import pandas as pd
from fastapi import HTTPException, status

TABLE_NAME = "dataset"


def _storage_root() -> Path:
    # Keep DuckDB + temp files under backend for now.
    return Path(__file__).resolve().parents[3] / ".duckdb"


def _chat_dir(*, chat_id: str) -> Path:
    """
    New layout: DuckDB files are stored per-chat so that shared collaborators can access the same dataset.
    Legacy layout is supported by `_duckdb_path`.
    """
    root = _storage_root()
    return root / chat_id


def _duckdb_path_new(*, chat_id: str) -> Path:
    return _chat_dir(chat_id=chat_id) / "chat.duckdb"


def _duckdb_path_legacy(*, user_id: str, chat_id: str) -> Path:
    # Legacy layout: `.duckdb/<user_id>/<chat_id>/chat.duckdb`
    root = _storage_root()
    return root / user_id / chat_id / "chat.duckdb"


def _duckdb_path(*, user_id: str, chat_id: str) -> Path:
    """
    Resolve DuckDB path for reads:
    1) new per-chat path
    2) legacy per-user path (if uploader user_id still matches)
    3) scan legacy dirs for this chat_id (needed when another collaborator queries older chats)
    """
    new_path = _duckdb_path_new(chat_id=chat_id)
    if new_path.exists():
        return new_path

    legacy_path = _duckdb_path_legacy(user_id=user_id, chat_id=chat_id)
    if legacy_path.exists():
        return legacy_path

    # Scan any legacy directory for this chat_id.
    root = _storage_root()
    try:
        for child in root.iterdir():
            candidate = child / chat_id / "chat.duckdb"
            if candidate.exists():
                return candidate
    except Exception:
        pass

    return new_path


def _allowed_file_ext(filename: str) -> str:
    lower = (filename or "").lower()
    if lower.endswith(".csv"):
        return "csv"
    if lower.endswith(".xlsx"):
        return "xlsx"
    if lower.endswith(".xls"):
        return "xls"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid file type. Upload CSV or Excel (.csv, .xls, .xlsx) only.",
    )


def _safe_table_schema_preview(columns: list[dict[str, Any]], max_cols: int = 60) -> str:
    trimmed = columns[:max_cols]
    parts = []
    for c in trimmed:
        parts.append(f"- {c['name']} ({c['type']})")
    if len(columns) > max_cols:
        parts.append(f"- ... ({len(columns) - max_cols} more columns)")
    return "\n".join(parts)


def chat_exists(*, user_id: str, chat_id: str) -> bool:
    return _duckdb_path(user_id=user_id, chat_id=chat_id).exists()


def load_dataset_from_upload(
    *,
    user_id: str,
    chat_id: str,
    file_bytes: bytes,
    filename: str,
) -> None:
    ext = _allowed_file_ext(filename)
    dest_dir = _chat_dir(chat_id=chat_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    db_path = _duckdb_path_new(chat_id=chat_id)

    # Persist uploaded bytes to disk so DuckDB can read them efficiently.
    ext_map = {"csv": ".csv", "xlsx": ".xlsx", "xls": ".xls"}
    local_path = dest_dir / f"upload{ext_map[ext]}"
    local_path.write_bytes(file_bytes)

    # Create/overwrite DuckDB.
    if db_path.exists():
        db_path.unlink()

    con = duckdb.connect(str(db_path))
    try:
        con.execute(f"PRAGMA threads=4;")
        con.execute(f"DROP TABLE IF EXISTS {TABLE_NAME};")

        if ext == "csv":
            con.execute(
                f"""
                CREATE TABLE {TABLE_NAME} AS
                SELECT * FROM read_csv_auto('{str(local_path).replace("'", "''")}', SAMPLE_SIZE=-1);
                """
            )
        else:
            # DuckDB Excel loading depends on extensions/version. Use pandas for now.
            if ext == "xlsx":
                df = pd.read_excel(str(local_path), engine="openpyxl")
            else:
                df = pd.read_excel(str(local_path), engine="xlrd")

            # Register dataframe then materialize into DuckDB.
            con.register("df", df)
            con.execute(f"CREATE TABLE {TABLE_NAME} AS SELECT * FROM df;")
            con.unregister("df")

        # Basic integrity check.
        con.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()
    finally:
        con.close()


def delete_chat_db(*, user_id: str, chat_id: str) -> None:
    # Best-effort cleanup.
    try:
        root = _storage_root()
        # New location
        new_dir = _chat_dir(chat_id=chat_id)
        if new_dir.exists():
            for p in new_dir.rglob("*"):
                if p.is_file():
                    p.unlink(missing_ok=True)
            for p in sorted(new_dir.rglob("*"), reverse=True):
                if p.is_dir():
                    p.rmdir()
            new_dir.rmdir()

        # Legacy locations: remove any `.duckdb/<any_user>/<chat_id>/...`
        try:
            for child in root.iterdir():
                legacy_dir = child / chat_id
                if not legacy_dir.exists():
                    continue
                for p in legacy_dir.rglob("*"):
                    if p.is_file():
                        p.unlink(missing_ok=True)
                for p in sorted(legacy_dir.rglob("*"), reverse=True):
                    if p.is_dir():
                        p.rmdir()
                legacy_dir.rmdir()
        except Exception:
            pass
    except Exception:
        pass


def get_table_schema(*, user_id: str, chat_id: str) -> list[dict[str, Any]]:
    db_path = _duckdb_path(user_id=user_id, chat_id=chat_id)
    if not db_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset not loaded yet. Please upload a file first.",
        )

    con = duckdb.connect(str(db_path), read_only=True)
    try:
        rows = con.execute(f"PRAGMA table_info('{TABLE_NAME}');").fetchall()
        # PRAGMA columns: cid, name, type, notnull, dflt_value, pk
        columns: list[dict[str, Any]] = []
        for r in rows:
            columns.append({"name": r[1], "type": r[2]})
        return columns
    finally:
        con.close()


def format_markdown_table(columns: list[str], rows: list[list[Any]], max_rows: int = 50) -> str:
    trimmed_rows = rows[:max_rows]
    header = "| " + " | ".join(str(c) for c in columns) + " |"
    sep = "| " + " | ".join(["---"] * len(columns)) + " |"
    body_lines = []
    for row in trimmed_rows:
        body_lines.append(
            "| "
            + " | ".join("" if v is None else str(v).replace("\n", " ")[:300] for v in row)
            + " |"
        )
    return "\n".join([header, sep, *body_lines])


def _strip_leading_sql_comments(s: str) -> str:
    """
    Remove leading SQL comments so we can validate the real first keyword.
    """
    out = s.lstrip()
    while True:
        if out.startswith("--"):
            out = re.sub(r"^--.*(?:\\r?\\n)", "", out, flags=re.DOTALL).lstrip()
            continue
        if out.startswith("/*"):
            out = re.sub(r"^/\\*.*?\\*/", "", out, flags=re.DOTALL).lstrip()
            continue
        break
    return out


def _is_safe_sql(*, sql: str) -> tuple[bool, str]:
    """
    Safety gate:
    - Allow SELECT analytics queries (ORDER BY, LIMIT, GROUP BY, MIN/MAX/COUNT, etc.)
    - Block only dangerous statements (DROP/DELETE/UPDATE/INSERT) and multi-statement SQL.
    - Block file/network access functions.
    """
    if not sql:
        return False, "Empty SQL."

    sql_no_comments = _strip_leading_sql_comments(sql)
    s = sql_no_comments.strip().lower()
    if not s:
        return False, "Empty SQL."

    # Allow a trailing semicolon, but reject multiple statements.
    if s.endswith(";"):
        s = s[:-1].rstrip()
    if ";" in s:
        return False, "Multiple statements are not allowed."

    if not (s.startswith("select") or s.startswith("with")):
        return False, "SQL must start with SELECT or WITH."

    destructive = ["drop", "delete", "update", "insert"]
    for verb in destructive:
        if re.search(rf"\b{re.escape(verb)}\b", s):
            return False, f"Destructive query is not allowed ({verb.upper()})."

    # Prevent file/network access functions.
    if any(fn in s for fn in ["read_csv", "read_excel", "read_parquet", "read_json"]):
        return False, "File/network access functions are not allowed."

    if "http://" in s or "https://" in s:
        return False, "Network access is not allowed."

    # Ensure the query targets the provided dataset table.
    if not re.search(rf"\b{re.escape(TABLE_NAME.lower())}\b", s):
        return False, f"Query must reference the `{TABLE_NAME}` table."

    return True, "OK"


def execute_sql_safe(
    *,
    user_id: str,
    chat_id: str,
    sql: str,
    max_rows: int = 50,
) -> tuple[list[str], list[list[Any]]]:
    print("Generated SQL:", sql)

    safe, reason = _is_safe_sql(sql=sql)
    if not safe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Generated SQL was rejected for safety reasons: {reason}",
        )

    sql_for_exec = sql.strip()
    if sql_for_exec.endswith(";"):
        sql_for_exec = sql_for_exec[:-1].rstrip()

    db_path = _duckdb_path(user_id=user_id, chat_id=chat_id)
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        wrapped_sql = f"SELECT * FROM ({sql_for_exec}) AS sub LIMIT {max_rows};"
        cursor = con.execute(wrapped_sql)
        rows = cursor.fetchall()
        columns = [d[0] for d in cursor.description] if cursor.description else []
        return columns, [list(r) for r in rows]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query execution failed. Please rephrase your request.",
        )
    finally:
        con.close()


def summarize_error_message(err: Exception) -> str:
    # Keep it user-safe.
    return "Your request couldn’t be answered from the uploaded dataset."


def schema_as_text(*, columns: list[dict[str, Any]]) -> str:
    return json.dumps(columns, ensure_ascii=False)


def _categorize_columns(schema: list[dict[str, Any]]) -> tuple[list[str], list[str], list[str]]:
    numeric: list[str] = []
    categorical: list[str] = []
    time_cols: list[str] = []

    for c in schema:
        name = str(c.get("name"))
        typ = str(c.get("type") or "").lower()
        if any(t in typ for t in ["int", "bigint", "double", "float", "decimal", "numeric", "real"]):
            numeric.append(name)
        elif any(t in typ for t in ["date", "timestamp", "datetime"]):
            time_cols.append(name)
        else:
            # DuckDB uses VARCHAR/TEXT for most strings.
            if any(t in typ for t in ["char", "text", "varchar", "string"]):
                categorical.append(name)
            else:
                # Default to categorical for non-numeric.
                categorical.append(name)

    return categorical, numeric, time_cols


def _quote_ident(ident: str) -> str:
    # DuckDB identifier quoting. We escape quotes but otherwise preserve the original column name.
    escaped = ident.replace('"', '""')
    return f'"{escaped}"'


def _build_in_filter(
    *,
    filter_column: str,
    values: list[str],
) -> tuple[str, list[Any]]:
    # Builds: `"col" IN (?, ?, ?)`
    placeholders = ", ".join(["?"] * len(values))
    clause = f"{_quote_ident(filter_column)} IN ({placeholders})"
    return clause, values


def get_chat_insights_inputs(*, user_id: str, chat_id: str) -> dict[str, Any]:
    schema = get_table_schema(user_id=user_id, chat_id=chat_id)
    categorical_cols, numeric_cols, time_cols = _categorize_columns(schema)

    db_path = _duckdb_path(user_id=user_id, chat_id=chat_id)
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        row_count = con.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
    finally:
        con.close()

    return {
        "schema": schema,
        "categorical_cols": categorical_cols,
        "numeric_cols": numeric_cols,
        "time_cols": time_cols,
        "row_count": int(row_count),
    }


def get_summary_stats(*, user_id: str, chat_id: str) -> dict[str, Any]:
    inputs = get_chat_insights_inputs(user_id=user_id, chat_id=chat_id)
    numeric_cols: list[str] = inputs["numeric_cols"]

    db_path = _duckdb_path(user_id=user_id, chat_id=chat_id)
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        numeric_stats: dict[str, Any] = {}
        for col in numeric_cols[:5]:
            stats = con.execute(
                f"""
                SELECT
                  MIN(CAST({_quote_ident(col)} AS DOUBLE)) AS min_val,
                  MAX(CAST({_quote_ident(col)} AS DOUBLE)) AS max_val,
                  AVG(CAST({_quote_ident(col)} AS DOUBLE)) AS mean_val,
                  STDDEV_SAMP(CAST({_quote_ident(col)} AS DOUBLE)) AS stddev_val
                FROM {TABLE_NAME}
                """
            ).fetchone()
            numeric_stats[col] = {
                "min": stats[0],
                "max": stats[1],
                "mean": stats[2],
                "stddev": stats[3],
            }
    finally:
        con.close()

    return {
        "row_count": inputs["row_count"],
        "columns": [c["name"] for c in inputs["schema"]],
        "numeric_columns": inputs["numeric_cols"][:5],
        "categorical_columns": inputs["categorical_cols"][:10],
        "time_columns": inputs["time_cols"][:10],
        "numeric_stats": numeric_stats,
    }


def get_filter_slicer_config(*, user_id: str, chat_id: str, top_n_values: int = 30) -> dict[str, Any]:
    schema = get_table_schema(user_id=user_id, chat_id=chat_id)
    categorical_cols, numeric_cols, _time_cols = _categorize_columns(schema)

    filter_col = categorical_cols[0] if categorical_cols else None
    if not filter_col:
        return {"filter_column": None, "values": []}

    db_path = _duckdb_path(user_id=user_id, chat_id=chat_id)
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        rows = con.execute(
            f"""
            SELECT { _quote_ident(filter_col) } AS value, COUNT(*) AS count
            FROM {TABLE_NAME}
            GROUP BY 1
            ORDER BY count DESC
            LIMIT {int(top_n_values)}
            """
        ).fetchall()
        values = [{"value": str(r[0]), "count": int(r[1])} for r in rows]
    finally:
        con.close()

    return {"filter_column": filter_col, "values": values}


def _resolve_chart_columns(*, inputs: dict[str, Any], chart_kind: str) -> tuple[str | None, str | None]:
    categorical_cols: list[str] = inputs["categorical_cols"]
    numeric_cols: list[str] = inputs["numeric_cols"]
    time_cols: list[str] = inputs["time_cols"]

    if chart_kind == "bar":
        x_col = categorical_cols[0] if categorical_cols else (numeric_cols[0] if numeric_cols else None)
        y_col = numeric_cols[0] if numeric_cols else None
        return x_col, y_col
    if chart_kind == "pie":
        x_col = categorical_cols[0] if categorical_cols else (numeric_cols[0] if numeric_cols else None)
        return x_col, None
    if chart_kind == "line":
        # Prefer time series; fall back to numeric index series.
        if time_cols and numeric_cols:
            return time_cols[0], numeric_cols[0]
        if numeric_cols:
            return None, numeric_cols[0]
        return None, None

    return None, None


def get_chart_data(
    *,
    user_id: str,
    chat_id: str,
    chart_kind: str,
    x_column: str | None,
    y_column: str | None,
    filter_column: str | None = None,
    filter_values: list[str] | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    inputs = get_chat_insights_inputs(user_id=user_id, chat_id=chat_id)
    schema_cols = {c["name"] for c in inputs["schema"]}

    for col in [x_column, y_column, filter_column]:
        if col and col not in schema_cols:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid column selection.")

    where_clause = ""
    params: list[Any] = []
    if filter_column and filter_values:
        filter_clause, filter_params = _build_in_filter(
            filter_column=filter_column,
            values=[str(v) for v in filter_values[:200]],
        )
        where_clause = f"WHERE {filter_clause}"
        params = filter_params

    db_path = _duckdb_path(user_id=user_id, chat_id=chat_id)
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        if chart_kind == "bar":
            if x_column is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No x column available.")
            if y_column:
                sql = f"""
                  SELECT CAST({ _quote_ident(x_column) } AS VARCHAR) AS label,
                         SUM(CAST({ _quote_ident(y_column) } AS DOUBLE)) AS value
                  FROM {TABLE_NAME}
                  {where_clause}
                  GROUP BY 1
                  ORDER BY value DESC
                  LIMIT {int(limit)}
                """
            else:
                sql = f"""
                  SELECT CAST({ _quote_ident(x_column) } AS VARCHAR) AS label,
                         COUNT(*) AS value
                  FROM {TABLE_NAME}
                  {where_clause}
                  GROUP BY 1
                  ORDER BY value DESC
                  LIMIT {int(limit)}
                """

            rows = con.execute(sql, params).fetchall()
            return [{"label": str(r[0]), "value": float(r[1])} for r in rows]

        if chart_kind == "pie":
            if x_column is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No x column available.")
            sql = f"""
              SELECT CAST({ _quote_ident(x_column) } AS VARCHAR) AS name,
                     COUNT(*) AS value
              FROM {TABLE_NAME}
              {where_clause}
              GROUP BY 1
              ORDER BY value DESC
              LIMIT {int(limit)}
            """
            rows = con.execute(sql, params).fetchall()
            return [{"name": str(r[0]), "value": int(r[1])} for r in rows]

        if chart_kind == "line":
            if y_column is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No y column available.")

            # If x_column is provided, treat it as time column (time series).
            if x_column:
                sql = f"""
                  SELECT CAST(DATE_TRUNC('day', { _quote_ident(x_column) }) AS VARCHAR) AS label,
                         AVG(CAST({ _quote_ident(y_column) } AS DOUBLE)) AS value
                  FROM {TABLE_NAME}
                  {where_clause}
                  GROUP BY 1
                  ORDER BY 1
                  LIMIT {int(max(limit * 5, 30))}
                """
                rows = con.execute(sql, params).fetchall()
                return [{"label": str(r[0]), "value": float(r[1]) if r[1] is not None else 0.0} for r in rows]

            # Otherwise fallback to row-number series.
            sql = f"""
              SELECT CAST(t.i AS VARCHAR) AS label,
                     t.y AS value
              FROM (
                SELECT row_number() OVER () AS i,
                       CAST({ _quote_ident(y_column) } AS DOUBLE) AS y
                FROM {TABLE_NAME}
                {where_clause}
                LIMIT {int(max(limit * 20, 100))}
              ) t
              ORDER BY t.i
            """
            rows = con.execute(sql, params).fetchall()
            return [{"label": str(r[0]), "value": float(r[1]) if r[1] is not None else 0.0} for r in rows]

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported chart type.")
    finally:
        con.close()


def get_suggested_charts_and_summary(*, user_id: str, chat_id: str) -> dict[str, Any]:
    schema_inputs = get_chat_insights_inputs(user_id=user_id, chat_id=chat_id)
    summary = get_summary_stats(user_id=user_id, chat_id=chat_id)
    slicer = get_filter_slicer_config(user_id=user_id, chat_id=chat_id)

    filter_column = slicer["filter_column"]
    filter_values: list[str] | None = None

    charts: list[dict[str, Any]] = []
    # Choose chart columns using dataset heuristics.
    bar_x, bar_y = _resolve_chart_columns(inputs=schema_inputs, chart_kind="bar")
    pie_x, _pie_y = _resolve_chart_columns(inputs=schema_inputs, chart_kind="pie")
    line_x, line_y = _resolve_chart_columns(inputs=schema_inputs, chart_kind="line")

    # Bar
    bar_data = get_chart_data(
        user_id=user_id,
        chat_id=chat_id,
        chart_kind="bar",
        x_column=bar_x,
        y_column=bar_y,
        filter_column=filter_column,
        filter_values=filter_values,
        limit=10,
    )
    charts.append(
        {
            "chart_kind": "bar",
            "title": f"Top {bar_x or 'categories'} by {bar_y or 'count'}",
            "x_column": bar_x,
            "y_column": bar_y,
            "x_label": bar_x,
            "y_label": bar_y or "count",
            "data": bar_data,
        }
    )

    # Line
    line_data = get_chart_data(
        user_id=user_id,
        chat_id=chat_id,
        chart_kind="line",
        x_column=line_x,
        y_column=line_y,
        filter_column=filter_column,
        filter_values=filter_values,
        limit=10,
    )
    charts.append(
        {
            "chart_kind": "line",
            "title": f"Trend by {line_x or 'sequence'}",
            "x_column": line_x,
            "y_column": line_y,
            "x_label": line_x or "index",
            "y_label": line_y,
            "data": line_data,
        }
    )

    # Pie
    pie_data = get_chart_data(
        user_id=user_id,
        chat_id=chat_id,
        chart_kind="pie",
        x_column=pie_x,
        y_column=None,
        filter_column=filter_column,
        filter_values=filter_values,
        limit=6,
    )
    charts.append(
        {
            "chart_kind": "pie",
            "title": f"Share of {pie_x or 'categories'}",
            "x_column": pie_x,
            "y_column": None,
            "x_label": pie_x,
            "y_label": "count",
            "data": pie_data,
        }
    )

    return {
        "summary": summary,
        "slicer": slicer,
        "suggested_charts": charts,
    }


def export_filtered_data_csv(
    *,
    user_id: str,
    chat_id: str,
    filter_column: str | None = None,
    filter_values: list[str] | None = None,
    limit_rows: int = 10000,
) -> str:
    schema_inputs = get_chat_insights_inputs(user_id=user_id, chat_id=chat_id)
    schema_cols = {c["name"] for c in schema_inputs["schema"]}
    if filter_column and filter_column not in schema_cols:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filter column.")

    where_clause = ""
    params: list[Any] = []
    if filter_column and filter_values:
        filter_clause, filter_params = _build_in_filter(
            filter_column=filter_column,
            values=[str(v) for v in filter_values[:200]],
        )
        where_clause = f"WHERE {filter_clause}"
        params = filter_params

    db_path = _duckdb_path(user_id=user_id, chat_id=chat_id)
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        sql = f"""
          SELECT * FROM {TABLE_NAME}
          {where_clause}
          LIMIT {int(limit_rows)}
        """
        df = con.execute(sql, params).fetchdf()
        return df.to_csv(index=False)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to export CSV.")
    finally:
        con.close()


def get_table_preview(
    *,
    user_id: str,
    chat_id: str,
    filter_column: str | None = None,
    filter_values: list[str] | None = None,
    preview_rows: int = 25,
    max_columns: int = 8,
) -> dict[str, Any]:
    schema_inputs = get_chat_insights_inputs(user_id=user_id, chat_id=chat_id)
    schema_cols = [c["name"] for c in schema_inputs["schema"]]
    schema_set = set(schema_cols)

    if filter_column and filter_column not in schema_set:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid filter column.")

    where_clause = ""
    params: list[Any] = []
    if filter_column and filter_values:
        filter_clause, filter_params = _build_in_filter(
            filter_column=filter_column,
            values=[str(v) for v in filter_values[:200]],
        )
        where_clause = f"WHERE {filter_clause}"
        params = filter_params

    db_path = _duckdb_path(user_id=user_id, chat_id=chat_id)
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        sql = f"""
          SELECT * FROM {TABLE_NAME}
          {where_clause}
          LIMIT {int(preview_rows)}
        """
        df = con.execute(sql, params).fetchdf()
        df = df.iloc[:, : int(max_columns)]
        return {
            "columns": [str(c) for c in df.columns.tolist()],
            "rows": df.where(df.notna(), None).values.tolist(),
        }
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to build table preview.")
    finally:
        con.close()

