"use client"
import BogTable, { ColumnHeaderCellContent, TableRow } from "@/components/BogTable/BogTable";
import BogCheckbox from "@/components/BogCheckbox/BogCheckbox";
import React from "react";
export default function Admin() {
    const student_columns: ColumnHeaderCellContent[] =
        [{
            content: 'Name',
            datatype: 'string'
        },
        {
            content: 'Email',
            datatype: 'string'
        },
        {
            content: 'Phone',
            datatype: 'string'
        },
        {
            content: 'Ramp',
            datatype: 'other'
        },
        {
            content: 'Status',
            datatype: 'string'
        },
        {
            content: 'Active',
            datatype: 'other'
        }];
    const student_rows: TableRow[] =
        [
            {
                cells: [
                    {
                        content: "Chen, Johnny"
                    },
                    {
                        content: "jchen3314@gatech.edu"
                    },
                    {
                        content: "262-327-3933"
                    },
                    {
                        content: <BogCheckbox checked disabled name='ramp' style={
                            { '--color-brand-text': '#0a7b4033',
                              '--checkbox-indicator-color': '#22070BB2'
                            } as React.CSSProperties}/>,
                    },
                    {
                        content: "Current"
                    },
                    {
                        content: <BogCheckbox checked="indeterminate" disabled name='active' style={
                            { '--color-brand-text': '#C73A3A33',
                              '--checkbox-indicator-color': '#22070BB2'
                            } as React.CSSProperties}/>,
                    }
                ]
            }];
    const driver_columns: ColumnHeaderCellContent[] =
        [{
            content: "Preferred Name",
            datatype: "string"
        },
        {
            content: "Email",
            datatype: "string"
        },
        {
            content: "Phone",
            datatype: "string"
        },
        {
            content: "Vehicle",
            datatype: "string"
        }];
    const vehicle_columns: ColumnHeaderCellContent[] =
        [{
            content: "License Plate",
            datatype: "string"
        },
        {
            content: "Make & Model",
            datatype: "string"
        },
        {
            content: "Assigned Driver?",
            datatype: "boolean"
        },
        {
            content: "Accessibility Features",
            datatype: "string"}]
    return (
        <div className = "flex h-screen w-screen">
        <div className = "bg-blue-100 w-[10%]">
            Sidebar
        </div>
        <BogTable columnHeaders={student_columns} rows={student_rows} size="responsive"/>
        </div>
    );
}
