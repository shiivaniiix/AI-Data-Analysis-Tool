"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  type SectorProps,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toPng } from "html-to-image";

import { ApiError, apiRequest } from "@/lib/api";

type SuggestedChart = {
  chart_kind: "bar" | "line" | "pie";
  title: string;
  x_column: string | null;
  y_column: string | null;
  x_label: string | null;
  y_label: string | null;
};

type BarLineDatum = { label: string; value: number };
type PieDatum = { name: string; value: number };

type SuggestedBarChart = SuggestedChart & {
  chart_kind: "bar";
  data: BarLineDatum[];
};
type SuggestedLineChart = SuggestedChart & {
  chart_kind: "line";
  data: BarLineDatum[];
};
type SuggestedPieChart = SuggestedChart & {
  chart_kind: "pie";
  data: PieDatum[];
};

type SuggestedAnyChart = SuggestedBarChart | SuggestedLineChart | SuggestedPieChart;

type InsightsResponse = {
  summary: unknown;
  slicer: {
    filter_column: string | null;
    values: Array<{ value: string; count: number }>;
  };
  suggested_charts: SuggestedAnyChart[];
  insights: string[];
};

type FilterState = {
  values: string[];
};

export function InsightsCharts({
  token,
  chatId,
  datasetVersion,
}: {
  token: string;
  chatId: string | null;
  datasetVersion: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [filter, setFilter] = useState<FilterState>({ values: [] });
  const [filterLoading, setFilterLoading] = useState(false);
  const [baseLoaded, setBaseLoaded] = useState(false);
  const [exportLoading, setExportLoading] = useState<null | "pdf" | "docx" | "csv">(null);

  const barRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const pieRef = useRef<HTMLDivElement | null>(null);

  const piePalette = useMemo(
    () => ["#06b6d4", "#8b5cf6", "#3b82f6", "#22c55e", "#f97316", "#f43f5e"],
    [],
  );

  const filterColumn = insights?.slicer.filter_column ?? null;
  const filterOptions = insights?.slicer.values ?? [];

  const selectedCharts = useMemo(() => insights?.suggested_charts ?? [], [insights]);

  const loadInsights = async () => {
    if (!chatId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<InsightsResponse>(`/chats/${chatId}/insights`, { token });
      setInsights(data);
      setFilter({ values: [] });
      setBaseLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load insights.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Re-load when the dataset becomes available/changes (file upload updates file_url).
    if (!chatId || !datasetVersion) return;
    void loadInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, datasetVersion]);

  const refreshChartData = async () => {
    if (!chatId || !insights) return;
    setFilterLoading(true);
    setError(null);
    try {
      const updatedCharts = await Promise.all(
        insights.suggested_charts.map(async (c) => {
          const resp = await apiRequest<{ data: unknown }>(`/chats/${chatId}/chart-data`, {
            method: "POST",
            token,
            body: {
              chart_kind: c.chart_kind,
              x_column: c.x_column,
              y_column: c.y_column,
              filter_column: filterColumn,
              filter_values: filter.values.length ? filter.values : null,
              limit: c.chart_kind === "pie" ? 6 : 10,
            },
          });
          if (c.chart_kind === "pie") {
            return { ...c, data: resp.data as PieDatum[] };
          }
          return { ...c, data: resp.data as BarLineDatum[] };
        }),
      );

      setInsights((prev) => (prev ? { ...prev, suggested_charts: updatedCharts } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to refresh charts.");
    } finally {
      setFilterLoading(false);
    }
  };

  useEffect(() => {
    // If user changes filters, update chart data.
    if (!insights || !baseLoaded) return;
    void refreshChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.values.join("|")]);

  const downloadExport = async (kind: "pdf" | "docx" | "csv") => {
    if (!chatId) return;
    if (!insights) return;

    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
      "http://localhost:8000/api";
    const apiPath = `/chats/${chatId}/export/${kind}`;

    setError(null);
    setExportLoading(kind);
    try {
      const resp = await fetch(`${apiBase}${apiPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filter_column: insights.slicer.filter_column,
          filter_values: filter.values.length ? filter.values : null,
          limit_rows: 10000,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        throw new Error(data?.detail ?? "Export failed.");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        kind === "pdf"
          ? `chat_${chatId}_report.pdf`
          : kind === "docx"
            ? `chat_${chatId}_report.docx`
            : `chat_${chatId}_export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export.");
    } finally {
      setExportLoading(null);
    }
  };

  const downloadExportPdf = () => void downloadExport("pdf");
  const downloadExportDocx = () => void downloadExport("docx");
  const downloadExportCsv = () => void downloadExport("csv");

  const downloadChartAsPng = async (ref: HTMLDivElement | null, filename: string) => {
    if (!ref) return;
    try {
      const dataUrl = await toPng(ref, { cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export chart.");
    }
  };

  const barChart = selectedCharts.find((c) => c.chart_kind === "bar");
  const lineChart = selectedCharts.find((c) => c.chart_kind === "line");
  const pieChart = selectedCharts.find((c) => c.chart_kind === "pie");

  return (
    <motion.div
      className="rounded-2xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-800/30 p-4 shadow-sm transition hover:shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Insights</h2>
          {insights?.insights?.length ? (
            <div className="mt-2 space-y-1 text-sm text-zinc-200">
              {insights.insights.map((t, idx) => (
                <p key={idx}>• {t}</p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void downloadExportCsv()}
            disabled={exportLoading !== null}
            className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md hover:scale-[1.03] duration-200"
          >
            {exportLoading === "csv" ? "Exporting CSV..." : "Download as CSV"}
          </button>
          <button
            type="button"
            onClick={() => void downloadExportPdf()}
            disabled={exportLoading !== null}
            className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md hover:scale-[1.03] duration-200"
          >
            {exportLoading === "pdf" ? "Generating PDF..." : "Export this as PDF"}
          </button>
          <button
            type="button"
            onClick={() => void downloadExportDocx()}
            disabled={exportLoading !== null}
            className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md hover:scale-[1.03] duration-200"
          >
            {exportLoading === "docx" ? "Generating DOC..." : "Generate DOC report"}
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-zinc-400">Analyzing dataset…</p>
      ) : (
        <>
          {filterColumn ? (
            <div className="mt-4 rounded-xl border border-zinc-700 bg-gradient-to-br from-zinc-900 to-zinc-800/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Slicer / Filter
                  </p>
                  <p className="mt-1 text-sm text-zinc-200">
                    {filterColumn}:{" "}
                    {filter.values.length ? `${filter.values.length} selected` : "All"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFilter({ values: [] })}
                    disabled={filterLoading}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-blue-500 hover:shadow-md disabled:opacity-70 focus:ring-2 focus:ring-blue-500"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filterOptions.slice(0, 10).map((opt) => {
                  const checked = filter.values.includes(opt.value);
                  return (
                    <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setFilter((prev) => {
                            const next = new Set(prev.values);
                            if (e.target.checked) next.add(opt.value);
                            else next.delete(opt.value);
                            return { values: Array.from(next) };
                          });
                        }}
                        disabled={filterLoading}
                      />
                      <span className="min-w-0 truncate">
                        {opt.value} <span className="text-zinc-400">({opt.count})</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {filterOptions.length > 10 ? (
                <p className="mt-2 text-xs text-zinc-400">Showing top 10 categories.</p>
              ) : null}
            </div>
          ) : null}

          {filterLoading ? (
            <p className="mt-4 text-sm text-zinc-400">Updating charts…</p>
          ) : null}

          <div className="mt-4 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              {barChart ? (
                <motion.div
                  ref={barRef}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-sm transition-all hover:shadow-xl hover:border-blue-500/50"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{barChart.title}</p>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadChartAsPng(barRef.current, `chart_bar_${chatId}.png`)
                      }
                      className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:shadow-md hover:scale-[1.03] duration-200"
                    >
                      PNG
                    </button>
                  </div>
                  <div className="mt-2 h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChart.data} margin={{ top: 10, right: 10, left: -5, bottom: 10 }}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0b1220",
                            border: "1px solid #334155",
                            color: "#fff",
                          }}
                          itemStyle={{ color: "#fff" }}
                          labelStyle={{ color: "#fff" }}
                        />
                        <Legend wrapperStyle={{ color: "#e5e7eb" }} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#e5e7eb" }} />
                        <YAxis tick={{ fill: "#e5e7eb" }} />
                        <Bar dataKey="value" name="Value" fill="url(#barGrad)" radius={[10, 10, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              ) : null}
            </div>

            <div className="lg:col-span-1">
              {lineChart ? (
                <motion.div
                  ref={lineRef}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-sm transition-all hover:shadow-xl hover:border-blue-500/50"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{lineChart.title}</p>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadChartAsPng(lineRef.current, `chart_line_${chatId}.png`)
                      }
                      className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:shadow-md hover:scale-[1.03] duration-200"
                    >
                      PNG
                    </button>
                  </div>
                  <div className="mt-2 h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineChart.data} margin={{ top: 10, right: 10, left: -5, bottom: 10 }}>
                        <defs>
                          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0b1220",
                            border: "1px solid #334155",
                            color: "#fff",
                          }}
                          itemStyle={{ color: "#fff" }}
                          labelStyle={{ color: "#fff" }}
                        />
                        <Legend wrapperStyle={{ color: "#e5e7eb" }} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#e5e7eb" }} />
                        <YAxis tick={{ fill: "#e5e7eb" }} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="Value"
                          stroke="url(#lineGrad)"
                          strokeWidth={3}
                          dot={false}
                          style={{ filter: "drop-shadow(0 0 7px rgba(139,92,246,0.35))" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              ) : null}
            </div>

            <div className="lg:col-span-1">
              {pieChart ? (
                <motion.div
                  ref={pieRef}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-sm transition-all hover:shadow-xl hover:border-blue-500/50"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{pieChart.title}</p>
                    <button
                      type="button"
                      onClick={() =>
                        void downloadChartAsPng(pieRef.current, `chart_pie_${chatId}.png`)
                      }
                      className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:shadow-md hover:scale-[1.03] duration-200"
                    >
                      PNG
                    </button>
                  </div>
                  <div className="mt-2 h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0b1220",
                            border: "1px solid #334155",
                            color: "#fff",
                          }}
                          itemStyle={{ color: "#fff" }}
                          labelStyle={{ color: "#fff" }}
                          formatter={(v: unknown) => [String(v), "Value"]}
                        />
                        <Legend wrapperStyle={{ color: "#e5e7eb" }} />
                        <Pie
                          data={pieChart.data}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="80%"
                          labelLine={false}
                          label={({ name }) => name}
                          activeShape={(props: SectorProps) => {
                            const outer =
                              typeof props.outerRadius === "number"
                                ? props.outerRadius
                                : Number(props.outerRadius ?? 0);
                            return <Sector {...props} outerRadius={outer + 10} />;
                          }}
                        >
                          {pieChart.data.map((_, idx) => (
                            <Cell
                              key={`pie-cell-${idx}`}
                              fill={piePalette[idx % piePalette.length]}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

