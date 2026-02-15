"use client";

import BogTable from "@/components/BogTable/BogTable";
import React, { useState } from "react";
import { useAdminTableData, type AdminTableType } from "./useAdminTableData";

const selected_gradient = "bg-gradient-to-r from-[#EDEDED] to-[#EDEDED00]";

export default function Admin() {
  const [table, setTable] = useState<AdminTableType>("Students");
  const { columns, rows, loading, error, usedFallback } = useAdminTableData(table);

  const switchTable = (
    event: React.MouseEvent<HTMLHeadingElement>,
    value: AdminTableType
  ) => {
    setTable(value);
  };

  return (
    <div className="flex h-screen w-screen">
      <div className="py-20 px-10 bg-gradient-to-b from-[#D9D9D9] to-[#B2B2B2] w-[12%] min-w-fit">
        <div className="mb-[10vh]">
          <p>GT Paratransit</p>
          <h3>Dashboard</h3>
        </div>
        <div>
          <h4
            className={`rounded p-5 hover:cursor-pointer ${table === "Students" ? selected_gradient : ""}`}
            onClick={(e) => switchTable(e, "Students")}
          >
            Students
          </h4>
          <h4
            className={`rounded p-5 hover:cursor-pointer ${table === "Drivers" ? selected_gradient : ""}`}
            onClick={(e) => switchTable(e, "Drivers")}
          >
            Drivers
          </h4>
          <h4
            className={`rounded p-5 hover:cursor-pointer ${table === "Vehicles" ? selected_gradient : ""}`}
            onClick={(e) => switchTable(e, "Vehicles")}
          >
            Vehicles
          </h4>
        </div>
      </div>
      <div className="py-20 px-10">
        <h1 className="mb-[10vh]">{table}</h1>
        {usedFallback && error && (
          <p className="mb-4 text-sm text-amber-700" role="status">
            {error}
          </p>
        )}
        {loading ? (
          <p className="text-gray-600">Loading…</p>
        ) : (
          <BogTable columnHeaders={columns} rows={rows} />
        )}
      </div>
    </div>
  );
}
