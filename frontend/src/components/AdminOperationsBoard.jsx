import { useState, useMemo, useRef } from "react";
import ConfirmDialog from "./ConfirmDialog";

const STATUSES = ["New", "Quoted", "Out for Delivery", "Completed"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];

const STATUS_COLORS = {
  New: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  Quoted: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "Out for Delivery": "bg-blue-500/10 text-blue-400 border-blue-500/30",
  Completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

const PRIORITY_COLORS = {
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Low: "bg-surface-500/10 text-surface-400 border-surface-500/30",
};

export default function AdminOperationsBoard({
  records = [],
  onUpdateStatus,
  onViewDetail,
}) {
  const [viewMode, setViewMode] = useState("table");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRecord, setExpandedRecord] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState(null); // { id, currentStatus, newStatus, institutionName }
  // Local status overrides for optimistic UI (maps record id -> temporary status)
  const [localOverrides, setLocalOverrides] = useState({});
  // "Don't ask again" — persists across dialog opens for the session
  const dontAskAgainRef = useRef(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (priorityFilter && r.priority !== priorityFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (r.institution_name || r.name || "").toLowerCase();
        const id = (r.id || "").toLowerCase();
        const summary = (r.summary || "").toLowerCase();
        if (
          !name.includes(q) &&
          !id.includes(q) &&
          !summary.includes(q)
        )
          return false;
      }
      return true;
    });
  }, [records, priorityFilter, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRecords = filteredRecords.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const toggleExpand = (id) => {
    setExpandedRecord(expandedRecord === id ? null : id);
  };

  const formatINR = (val) => {
    if (!val && val !== 0) return "—";
    return "Rs " + Number(val).toLocaleString("en-IN");
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleStatusChange = (id, newStatus, currentStatus, institutionName) => {
    // If user chose to skip confirmations for the session, apply immediately
    if (dontAskAgainRef.current) {
      setLocalOverrides(prev => ({ ...prev, [id]: newStatus }));
      if (onUpdateStatus) onUpdateStatus(id, newStatus, currentStatus);
      return;
    }
    // Optimistically update local display
    setLocalOverrides(prev => ({ ...prev, [id]: newStatus }));
    // Show confirmation dialog
    setConfirmDialog({ id, currentStatus, newStatus, institutionName });
  };

  const handleConfirmStatus = () => {
    if (!confirmDialog) return;
    const { id, newStatus, currentStatus } = confirmDialog;
    setConfirmDialog(null);
    if (onUpdateStatus) {
      onUpdateStatus(id, newStatus, currentStatus);
    }
    // Clear local override so it doesn't conflict with parent updates
    setLocalOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDontAskAgainChange = (checked) => {
    setDontAskAgain(checked);
    dontAskAgainRef.current = checked;
  };

  const handleCancelStatus = () => {
    if (!confirmDialog) return;
    const { id } = confirmDialog;
    setConfirmDialog(null);
    // Remove local override, reverting the select to original value
    setLocalOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Helper: get effective status (local override or original record status)
  const getEffectiveStatus = (rec) => localOverrides[rec.id] || rec.status || "New";

  // Helper: get institution name for display
  const getInstName = (rec) => rec.institution_name || rec.name || "Unknown";

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name, ID, or summary..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
          />
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:border-cyan-500/50 transition-all"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 focus:outline-none focus:border-cyan-500/50 transition-all"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="flex items-center bg-surface-800 border border-surface-700 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("table")}
            className={
              "px-3 py-2 text-xs font-medium transition-colors " +
              (viewMode === "table"
                ? "bg-cyan-500/15 text-cyan-400"
                : "text-surface-400 hover:text-surface-200")
            }
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={
              "px-3 py-2 text-xs font-medium transition-colors " +
              (viewMode === "cards"
                ? "bg-cyan-500/15 text-cyan-400"
                : "text-surface-400 hover:text-surface-200")
            }
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
        </div>

        <span className="text-xs text-surface-500 whitespace-nowrap">
          {filteredRecords.length} / {records.length} records
        </span>
      </div>

      {/* ── TABLE VIEW ──────────────────────────────────────────────── */}
      {viewMode === "table" ? (
        <div className="card overflow-hidden">
          {paginatedRecords.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-700/50 bg-surface-800/50">
                      <th className="w-10 px-3 py-2.5" />
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                        Institution
                      </th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700/30">
                    {paginatedRecords.map((rec) => {
                      const isExpanded = expandedRecord === rec.id;
                      return (
                        <tr
                          key={rec.id}
                          className="hover:bg-surface-700/20 transition-colors"
                        >
                          <td className="px-3 py-3">
                            <button
                              onClick={() => toggleExpand(rec.id)}
                              className="text-surface-500 hover:text-surface-200 transition-colors"
                            >
                              <svg
                                className={
                                  "w-4 h-4 transition-transform duration-200 " +
                                  (isExpanded ? "rotate-90" : "")
                                }
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <div>
                              <p className="text-sm font-medium text-surface-200 truncate max-w-[200px]">
                                {rec.institution_name || rec.name || "—"}
                              </p>
                              <p className="text-[10px] text-surface-500 mt-0.5">
                                {rec.id?.slice(0, 12) || ""}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={
                                "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border " +
                                (STATUS_COLORS[rec.status] ||
                                  "bg-surface-700 text-surface-400 border-surface-600")
                              }
                            >
                              {rec.status || "New"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={
                                "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border " +
                                (PRIORITY_COLORS[rec.priority] ||
                                  "bg-surface-700 text-surface-400 border-surface-600")
                              }
                            >
                              {rec.priority || "Low"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="text-sm font-semibold text-surface-200">
                              {formatINR(rec.total_estimated_cost)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs text-surface-400">
                              {formatDate(rec.created_at)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <select
                                value={getEffectiveStatus(rec)}
                                onChange={(e) =>
                                  handleStatusChange(rec.id, e.target.value, rec.status, getInstName(rec))
                                }
                                className="px-2 py-1 bg-surface-800 border border-surface-700 rounded text-[10px] text-surface-300 focus:outline-none focus:border-cyan-500/50 transition-all"
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              {onViewDetail && (
                                <button
                                  onClick={() => onViewDetail(rec.id)}
                                  className="p-1.5 rounded text-surface-500 hover:text-cyan-400 hover:bg-surface-700 transition-all"
                                  title="View details"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ────────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-surface-700/50 bg-surface-800/30">
                  <span className="text-xs text-surface-500">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(1, safeCurrentPage - 1))
                      }
                      disabled={safeCurrentPage <= 1}
                      className="px-2.5 py-1.5 rounded text-xs font-medium bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    {Array.from(
                      { length: Math.min(totalPages, 5) },
                      (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (safeCurrentPage <= 3) {
                          pageNum = i + 1;
                        } else if (safeCurrentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = safeCurrentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={
                              "px-2.5 py-1.5 rounded text-xs font-medium transition-all " +
                              (safeCurrentPage === pageNum
                                ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                                : "bg-surface-800 border border-surface-700 text-surface-400 hover:bg-surface-700")
                            }
                          >
                            {pageNum}
                          </button>
                        );
                      }
                    )}
                    <button
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, safeCurrentPage + 1))
                      }
                      disabled={safeCurrentPage >= totalPages}
                      className="px-2.5 py-1.5 rounded text-xs font-medium bg-surface-800 border border-surface-700 text-surface-300 hover:bg-surface-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-surface-600 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-surface-400 text-sm mb-1">
                No matching records found
              </p>
              <p className="text-xs text-surface-500">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ── CARD VIEW ──────────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedRecords.length > 0 ? (
            paginatedRecords.map((rec) => {
              const isExpanded = expandedRecord === rec.id;
              return (
                <div
                  key={rec.id}
                  className="card p-4 hover:border-cyan-500/30 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-200 truncate">
                        {rec.institution_name || rec.name || "—"}
                      </p>
                      <p className="text-[10px] text-surface-500 mt-0.5">
                        {rec.id?.slice(0, 12) || ""}
                      </p>
                    </div>
                    <span
                      className={
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ml-2 flex-shrink-0 " +
                        (STATUS_COLORS[rec.status] ||
                          "bg-surface-700 text-surface-400 border-surface-600")
                      }
                    >
                      {rec.status || "New"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border " +
                        (PRIORITY_COLORS[rec.priority] ||
                          "bg-surface-700 text-surface-400 border-surface-600")
                      }
                    >
                      {rec.priority || "Low"}
                    </span>
                    <span className="text-xs text-surface-400">
                      {formatDate(rec.created_at)}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-surface-200 mb-3">
                    {formatINR(rec.total_estimated_cost)}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-surface-700/30">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={getEffectiveStatus(rec)}
                        onChange={(e) =>
                          handleStatusChange(rec.id, e.target.value, rec.status, getInstName(rec))
                        }
                        className="px-2 py-1 bg-surface-800 border border-surface-700 rounded text-[10px] text-surface-300 focus:outline-none focus:border-cyan-500/50 transition-all"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      {onViewDetail && (
                        <button
                          onClick={() => onViewDetail(rec.id)}
                          className="p-1.5 rounded text-surface-500 hover:text-cyan-400 hover:bg-surface-700 transition-all text-xs"
                          title="View details"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => toggleExpand(rec.id)}
                        className="p-1.5 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-all text-xs"
                        title="Show log"
                      >
                        <svg
                          className={
                            "w-3.5 h-3.5 transition-transform duration-200 " +
                            (isExpanded ? "rotate-180" : "")
                          }
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* ── Expanded action log ──────────────────────────── */}
                  {isExpanded && rec.actionLog && rec.actionLog.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-surface-700/30 space-y-1.5">
                      {rec.actionLog.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-surface-300">
                              {log.action}
                            </p>
                            <p className="text-[9px] text-surface-500">
                              {log.user || "System"} ·{" "}
                              {log.timestamp
                                ? new Date(log.timestamp).toLocaleString(
                                    "en-IN",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )
                                : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {isExpanded &&
                    (!rec.actionLog || rec.actionLog.length === 0) && (
                      <div className="mt-3 pt-3 border-t border-surface-700/30 text-center">
                        <p className="text-[11px] text-surface-500">
                          No action log entries
                        </p>
                      </div>
                    )}
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-surface-600 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-surface-400 text-sm mb-1">
                No matching records found
              </p>
              <p className="text-xs text-surface-500">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Confirmation Dialog ──────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDialog}
        title="Change Status"
        message={confirmDialog ? `Are you sure you want to change "${confirmDialog.institutionName}" from "${confirmDialog.currentStatus}" to "${confirmDialog.newStatus}"?` : ''}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        variant="warning"
        onConfirm={handleConfirmStatus}
        onCancel={handleCancelStatus}
        showDontAskAgain={true}
        dontAskAgain={dontAskAgain}
        onDontAskAgainChange={handleDontAskAgainChange}
      />
    </div>
  );
}
