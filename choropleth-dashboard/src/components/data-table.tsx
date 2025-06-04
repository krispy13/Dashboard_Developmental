"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react"

interface RowData {
  county: string
  state: string
  inactive: number
  active: number
}

interface HistogramAPIResponse {
  cleaned_conds: string[]
  histogram_data: [number[], number[]]
  ite_scores: [number, number]
  test_scores: [number, number, number,number,number]
}

interface TableProps {
  county_names: string[] | null
  state_names: string[] | null
  histData: HistogramAPIResponse | null
}

const dummyData: RowData[] = [
  { county: "County 1", state: "State A", inactive: 10, active: 20 },
  { county: "County 2", state: "State B", inactive: 15, active: 25 },
  { county: "County 3", state: "State C", inactive: 8, active: 18 },
  { county: "County 4", state: "State D", inactive: 12, active: 22 },
  { county: "County 5", state: "State E", inactive: 20, active: 30 },
];

const DataTable: React.FC<TableProps> = ({ county_names, state_names, histData }) => {
  const [data, setData] = useState<RowData[]>(dummyData)
  const [filteredData, setFilteredData] = useState<RowData[]>(dummyData)
  const [sortColumn, setSortColumn] = useState<keyof RowData | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [filterValue, setFilterValue] = useState("")
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8
  const [totalPages, setTotalPages] = useState(1)
  const [paginatedData, setPaginatedData] = useState<RowData[]>([])
  
  // Process data only when props change, using useEffect
  useEffect(() => {
    if (county_names && state_names && histData) {
      const processedData = county_names.map((county, index) => ({
        county,
        state: state_names[index],
        inactive: histData.histogram_data[0][index],
        active: histData.histogram_data[1][index],
      }));
      
      setData(processedData);
      setFilteredData(processedData);
      setCurrentPage(1); // Reset to first page when data changes
    }
  }, [county_names, state_names, histData]);
  
  // Update pagination when filtered data or current page changes
  useEffect(() => {
    const total = Math.ceil(filteredData.length / itemsPerPage);
    setTotalPages(total > 0 ? total : 1);
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const slicedData = filteredData.slice(startIndex, endIndex);
    
    setPaginatedData(slicedData);
  }, [filteredData, currentPage, itemsPerPage]);

  const handleSort = (column: keyof RowData) => {
    const newDirection = sortColumn === column && sortDirection === "asc" ? "desc" : "asc";
    setSortColumn(column);
    setSortDirection(newDirection);

    const sortedData = [...filteredData].sort((a, b) => {
      if (a[column] < b[column]) return newDirection === "asc" ? -1 : 1;
      if (a[column] > b[column]) return newDirection === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredData(sortedData);
    setCurrentPage(1); // Reset to first page after sorting
  };

  const handleFilter = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toLowerCase();
    setFilterValue(value);

    const filtered = data.filter((item) => 
      item.county.toLowerCase().includes(value) || 
      item.state.toLowerCase().includes(value)
    );
    
    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page after filtering
  };
  
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (!county_names || !state_names || !histData) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <Input 
        placeholder="Filter by county or state" 
        value={filterValue} 
        onChange={handleFilter} 
        className="mb-4" 
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button variant="ghost" className="px-0" onClick={() => handleSort("county")}>
                County <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" className="px-0" onClick={() => handleSort("state")}>
                State <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" className="px-0" onClick={() => handleSort("inactive")}>
                Inactive <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" className="px-0" onClick={() => handleSort("active")}>
                Active <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.length > 0 ? (
            paginatedData.map((item, i) => (
              <TableRow key={i}>
                <TableCell>{item.county}</TableCell>
                <TableCell>{item.state}</TableCell>
                <TableCell>{item.inactive.toFixed(3)}</TableCell>
                <TableCell>{item.active.toFixed(3)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-6">No results found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-500">
          Showing {paginatedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrevPage} 
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="flex items-center px-2">
            Page {currentPage} of {totalPages}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleNextPage} 
            disabled={currentPage === totalPages}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;