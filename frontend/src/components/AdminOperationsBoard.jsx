import { useState, useMemo } from "react";
const STATUSES = ["New", "Quoted", "Out for Delivery", "Completed"];
export default function AdminOperationsBoard({ records = [], onUpdateStatus, onViewDetail }) {
  const [viewMode, setViewMode] = useState("table");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRecord, setExpandedRecord] = useState(null);
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (priorityFilter && r.priority !== priorityFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (r.institution_name || r.name || "").toLowerCase();
        const id = (r.id || "").toLowerCase();
        if (!name.includes(q) && !id.includes(q)) return false;
      }
      return true;
    });
  }, [records, priorityFilter, statusFilter, searchQuery]);
  return <div>Admin Operations Board - {filteredRecords.length} records</div>;
}
